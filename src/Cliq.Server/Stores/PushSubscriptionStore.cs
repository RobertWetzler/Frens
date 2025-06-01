using Cliq.Server.Data;
using Cliq.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace Cliq.Server.Store;

public interface IPushSubscriptionStore
{
    Task StoreSubscriptionAsync(Guid userId, PushSubscriptionDto subscription);
    Task ForEachSubscriptionAsync(Action<EfPushSubscription> action);
    Task RemoveSubscriptionAsync(string endpoint);
}

public class PushSubscriptionStore : IPushSubscriptionStore
{
    private readonly CliqDbContext _dbContext;

    public PushSubscriptionStore(CliqDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task StoreSubscriptionAsync(Guid userId, PushSubscriptionDto subscription)
    {
        if (subscription == null)
        {
            throw new ArgumentNullException(nameof(subscription));
        }

        var subscriptionToAdd = new EfPushSubscription
        {
            Endpoint = subscription.Endpoint,
            P256DH = subscription.P256DH,
            Auth = subscription.Auth,
            UserId = userId, // Store user ID as string
            CreatedAt = DateTime.UtcNow
        };
        _dbContext.PushSubscriptions.Add(subscriptionToAdd);
        await _dbContext.SaveChangesAsync();
    }

    public async Task RemoveSubscriptionAsync(string endpoint)
    {
        if (string.IsNullOrEmpty(endpoint))
        {
            throw new ArgumentNullException(nameof(endpoint));
        }

        var subscription = await _dbContext.PushSubscriptions
            .FirstOrDefaultAsync(s => s.Endpoint == endpoint);

        if (subscription != null)
        {
            _dbContext.PushSubscriptions.Remove(subscription);
            await _dbContext.SaveChangesAsync();
        }
    }

    public async Task ForEachSubscriptionAsync(Action<EfPushSubscription> action)
    {
        if (action == null)
        {
            throw new ArgumentNullException(nameof(action));
        }

        await foreach (var subscription in _dbContext.PushSubscriptions.AsAsyncEnumerable())
        {
            action(subscription);
        }
    }
}