using System.Data;
using System.Text.Json;
using Cliq.Server.Data;
using Cliq.Server.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Cliq.Server.Services.PushNotifications;

public interface IPushNotificationQueueService
{
    Task AddAsync(Guid userId, NotificationData notificationData);
    Task AddBulkAsync(CliqDbContext dbContext, IEnumerable<Guid> userIds, NotificationData notificationData);
    Task<List<NotificationDelivery>> DequeueAsync(int batchSize, CancellationToken cancellationToken = default);
    Task MarkAsSentAsync(Guid deliveryId);
    Task MarkAsFailedAsync(Guid deliveryId);
}
public class PushNotificationQueueService : IPushNotificationQueueService
{
    private readonly IServiceScopeFactory _serviceScopeFactory;
    private readonly ISilentDbContextFactory _silentDbContextFactory;
    private string _instanceId;
    private readonly TimeSpan _lockLeaseDuration = TimeSpan.FromMinutes(1);
    
    public PushNotificationQueueService(
        IServiceScopeFactory serviceScopeFactory, 
        ISilentDbContextFactory silentDbContextFactory)
    {
        _serviceScopeFactory = serviceScopeFactory;
        _silentDbContextFactory = silentDbContextFactory;
        // Read instance ID from environment variable
        _instanceId = Environment.GetEnvironmentVariable("FLY_MACHINE_ID") ?? string.Empty;
        if (string.IsNullOrEmpty(_instanceId))
        {
            // Log warning and choose random guid
            Console.WriteLine("FLY_MACHINE_ID environment variable is not set. Using a random GUID for instance ID.");
            _instanceId = Guid.NewGuid().ToString();
        }
    }

    /// <summary>
    /// Add a notification for a single user with its own scope and transaction.
    /// This method creates its own scope because it's typically called as fire-and-forget
    /// (no await) after an operation has already been saved (e.g., friend requests).
    /// 
    /// Note: If you need transactional behavior (notification rolled back if operation fails),
    /// use AddBulkAsync with the injected _dbContext instead, and await the call.
    /// </summary>
    public async Task AddAsync(Guid userId, NotificationData notificationData)
    {
        using var scope = _serviceScopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<CliqDbContext>();
        
        using var transaction = await dbContext.Database.BeginTransactionAsync();

        try
        {
            // Step 1: Create the logical notification
            var notification = new Notification
            {
                UserId = userId,
                Title = notificationData.Title,
                Message = notificationData.Message,
                Metadata = notificationData.Metadata,
                Navigate = notificationData.Navigate,
                CreatedAt = DateTime.UtcNow,
            };

            dbContext.Notifications.Add(notification);
            await dbContext.SaveChangesAsync(); // Save to get Notification.Id

            // Step 2: Fetch all subscriptions for the user
            var subscriptions = await dbContext.Set<EfPushSubscription>()
                .Where(s => s.UserId == userId)
                .ToListAsync();

            // Step 3: Create one delivery per subscription
            var deliveries = subscriptions.Select(s => new NotificationDelivery
            {
                NotificationId = notification.Id,
                PushSubscriptionEndpoint = s.Endpoint,
                SubscriptionId = s.Id,
                Status = "pending",
                Retries = 0,
                CreatedAt = DateTime.UtcNow
            });

            dbContext.AddRange(deliveries);

            // Step 4: Save deliveries and commit
            await dbContext.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    /// <summary>
    /// Add bulk notifications using the provided DbContext
    /// Will participate in any existing transaction on the DbContext
    /// </summary>
    public async Task AddBulkAsync(CliqDbContext dbContext, IEnumerable<Guid> userIds, NotificationData notificationData)
    {
        var userIdsList = userIds.ToList();
        if (!userIdsList.Any())
        {
            return;
        }

        // Step 1: Get all subscriptions for all users in one query
        var allSubscriptions = await dbContext.Set<EfPushSubscription>()
            .Where(s => userIdsList.Contains(s.UserId ?? Guid.Empty))
            .ToListAsync();

        // Step 2: Create one notification per user
        var notifications = userIdsList.Select(userId => new Notification
        {
            UserId = userId,
            Title = notificationData.Title,
            Message = notificationData.Message,
            Metadata = notificationData.Metadata,
            Navigate = notificationData.Navigate,
            CreatedAt = DateTime.UtcNow,
        }).ToList();

        dbContext.Notifications.AddRange(notifications);
        await dbContext.SaveChangesAsync(); // Save to get Notification.Ids

        // Step 3: Create deliveries for all subscriptions
        var deliveries = new List<NotificationDelivery>();
        foreach (var notification in notifications)
        {
            var userSubscriptions = allSubscriptions.Where(s => s.UserId == notification.UserId);
            deliveries.AddRange(userSubscriptions.Select(s => new NotificationDelivery
            {
                NotificationId = notification.Id,
                PushSubscriptionEndpoint = s.Endpoint,
                SubscriptionId = s.Id,
                Status = "pending",
                Retries = 0,
                CreatedAt = DateTime.UtcNow
            }));
        }

        dbContext.AddRange(deliveries);
        await dbContext.SaveChangesAsync();
    }

public async Task<List<NotificationDelivery>> DequeueAsync(int batchSize, CancellationToken cancellationToken = default)
{
    using var dbContext = _silentDbContextFactory.CreateContext();
    using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead, cancellationToken);

    // Atomically update and return the locked records
    var deliveryIds = await dbContext.Database.SqlQueryRaw<Guid>(@"
        UPDATE notification_delivery 
        SET status = 'processing', 
            locked_by = {0}, 
            locked_until = NOW() + INTERVAL '1 minute'
        WHERE id IN (
            SELECT id FROM notification_delivery
            WHERE status = 'pending'
              AND (locked_until IS NULL OR locked_until < NOW())
            ORDER BY created_at
            LIMIT {1}
            FOR UPDATE SKIP LOCKED
        )
        RETURNING id
    ", _instanceId, batchSize).ToListAsync(cancellationToken);

    if (!deliveryIds.Any())
    {
        await transaction.RollbackAsync(cancellationToken);
        return new();
    }

    // Now fetch the full objects with includes
    var deliveries = await dbContext.Set<NotificationDelivery>()
        .Where(d => deliveryIds.Contains(d.Id))
        .Include(d => d.Notification)
        .Include(d => d.Subscription)
        .ToListAsync(cancellationToken);

    await transaction.CommitAsync(cancellationToken);
    return deliveries;
}

    public async Task MarkAsSentAsync(Guid deliveryId)
    {
        using var scope = _serviceScopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<CliqDbContext>();
        
        var delivery = await dbContext.Set<NotificationDelivery>().FindAsync(deliveryId);
        if (delivery != null)
        {
            delivery.Status = "sent";
            delivery.LockedBy = null;
            delivery.LockedUntil = null;
            await dbContext.SaveChangesAsync();
        }
    }

    public async Task MarkAsFailedAsync(Guid deliveryId)
    {
        using var scope = _serviceScopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<CliqDbContext>();
        
        var delivery = await dbContext.Set<NotificationDelivery>().FindAsync(deliveryId);
        if (delivery != null)
        {
            delivery.Retries++;
            delivery.Status = delivery.Retries >= 3 ? "failed" : "pending";
            delivery.LockedBy = null;
            delivery.LockedUntil = null;
            await dbContext.SaveChangesAsync();
        }
    }
}
