using System.Data;
using Cliq.Server.Data;
using Cliq.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace Cliq.Server.Services.PushNotifications;

public interface IPushNotificationQueueService
{
    Task AddAsync(Guid userId, string mePushNotificationQueueServicessage, string metadata);
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
        _instanceId = Environment.GetEnvironmentVariable("FLY_MACHINE_ID");
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

public async Task<List<NotificationDelivery>> DequeueAsync(int batchSize, CancellationToken cancellationToken = default)
{
    using var transaction = await _dbContext.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead, cancellationToken);

    // Atomically update and return the locked records
    var deliveryIds = await _dbContext.Database.SqlQueryRaw<Guid>($@"
        UPDATE notification_delivery 
        SET status = 'processing', 
            locked_by = {_instanceId}, 
            locked_until = NOW() + INTERVAL '1 minute'
        WHERE id IN (
            SELECT id FROM notification_delivery
            WHERE status = 'pending'
              AND (locked_until IS NULL OR locked_until < NOW())
            ORDER BY created_at
            LIMIT {batchSize}
            FOR UPDATE SKIP LOCKED
        )
        RETURNING id
    ").ToListAsync(cancellationToken);

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