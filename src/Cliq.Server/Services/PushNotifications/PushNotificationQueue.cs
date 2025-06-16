using System.Data;
using System.Text.Json;
using Cliq.Server.Data;
using Cliq.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace Cliq.Server.Services.PushNotifications;

public interface IPushNotificationQueueService
{
    Task AddAsync(Guid userId, string message, string metadata);
    Task AddBulkAsync(IEnumerable<Guid> userIds, string message, string metadata);
    Task AddNotificationAsync<T>(Guid userId, T notificationData, string? actorName = null) where T : NotificationData;
    Task AddNotificationBulkAsync<T>(IEnumerable<Guid> userIds, T notificationData, string? actorName = null) where T : NotificationData;
    Task<List<NotificationDelivery>> DequeueAsync(int batchSize, CancellationToken cancellationToken = default);
    Task MarkAsSentAsync(Guid deliveryId);
    Task MarkAsFailedAsync(Guid deliveryId);
}
public class PushNotificationQueueService : IPushNotificationQueueService
{
    private readonly CliqDbContext _dbContext;
    private string _instanceId;
    private readonly TimeSpan _lockLeaseDuration = TimeSpan.FromMinutes(1);
    public PushNotificationQueueService(CliqDbContext cliqDbContext)
    {
        _dbContext = cliqDbContext;
        // Read instance ID from environment variable
        _instanceId = Environment.GetEnvironmentVariable("FLY_MACHINE_ID") ?? string.Empty;
        if (string.IsNullOrEmpty(_instanceId))
        {
            // Log warning and choose random guid
            Console.WriteLine("FLY_MACHINE_ID environment variable is not set. Using a random GUID for instance ID.");
            _instanceId = Guid.NewGuid().ToString();
        }
    }

    public async Task AddAsync(Guid userId, string message, string metadata)
    {
        using var transaction = await _dbContext.Database.BeginTransactionAsync();

        try
        {
            // Step 1: Create the logical notification
            var notification = new Notification
            {
                UserId = userId,
                Message = message,
                Metadata = metadata,
                CreatedAt = DateTime.UtcNow,
            };

            _dbContext.Notifications.Add(notification);
            await _dbContext.SaveChangesAsync(); // Save to get Notification.Id

            // Step 2: Fetch all subscriptions for the user
            var subscriptions = await _dbContext.Set<EfPushSubscription>()
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

            _dbContext.AddRange(deliveries);

            // Step 4: Save deliveries and commit
            await _dbContext.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task AddBulkAsync(IEnumerable<Guid> userIds, string message, string metadata)
    {
        using var transaction = await _dbContext.Database.BeginTransactionAsync();

        try
        {
            var userIdsList = userIds.ToList();
            if (!userIdsList.Any())
            {
                await transaction.CommitAsync();
                return;
            }

            // Step 1: Get all subscriptions for all users in one query
            var allSubscriptions = await _dbContext.Set<EfPushSubscription>()
                .Where(s => userIdsList.Contains(s.UserId ?? Guid.Empty))
                .ToListAsync();

            if (!allSubscriptions.Any())
            {
                await transaction.CommitAsync();
                return;
            }

            // Step 2: Create one notification per user
            var notifications = userIdsList.Select(userId => new Notification
            {
                UserId = userId,
                Message = message,
                Metadata = metadata,
                CreatedAt = DateTime.UtcNow,
            }).ToList();

            _dbContext.Notifications.AddRange(notifications);
            await _dbContext.SaveChangesAsync(); // Save to get Notification.Ids

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

            _dbContext.AddRange(deliveries);
            await _dbContext.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task AddNotificationAsync<T>(Guid userId, T notificationData, string? actorName = null) where T : NotificationData
    {
        var message = notificationData.GetMessage(actorName);
        var metadata = JsonSerializer.Serialize(notificationData.GetMetadata(), new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        await AddAsync(userId, message, metadata);
    }

    public async Task AddNotificationBulkAsync<T>(IEnumerable<Guid> userIds, T notificationData, string? actorName = null) where T : NotificationData
    {
        var message = notificationData.GetMessage(actorName);
        var metadata = JsonSerializer.Serialize(notificationData.GetMetadata(), new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        await AddBulkAsync(userIds, message, metadata);
    }

public async Task<List<NotificationDelivery>> DequeueAsync(int batchSize, CancellationToken cancellationToken = default)
{
    using var transaction = await _dbContext.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead, cancellationToken);

    // Atomically update and return the locked records
    var deliveryIds = await _dbContext.Database.SqlQueryRaw<Guid>(@"
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
    var deliveries = await _dbContext.Set<NotificationDelivery>()
        .Where(d => deliveryIds.Contains(d.Id))
        .Include(d => d.Notification)
        .Include(d => d.Subscription)
        .ToListAsync(cancellationToken);

    await transaction.CommitAsync(cancellationToken);
    return deliveries;
}

    public async Task MarkAsSentAsync(Guid deliveryId)
    {
        var delivery = await _dbContext.Set<NotificationDelivery>().FindAsync(deliveryId);
        if (delivery != null)
        {
            delivery.Status = "sent";
            delivery.LockedBy = null;
            delivery.LockedUntil = null;
            await _dbContext.SaveChangesAsync();
        }
    }

    public async Task MarkAsFailedAsync(Guid deliveryId)
    {
        var delivery = await _dbContext.Set<NotificationDelivery>().FindAsync(deliveryId);
        if (delivery != null)
        {
            delivery.Retries++;
            delivery.Status = delivery.Retries >= 3 ? "failed" : "pending";
            delivery.LockedBy = null;
            delivery.LockedUntil = null;
            await _dbContext.SaveChangesAsync();
        }
    }
}