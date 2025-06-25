
using System.Net;
using Cliq.Server.Store;
using Lib.Net.Http.WebPush;

namespace Cliq.Server.Services.PushNotifications;

public interface IPushNotificationService
{
    Task SendNotificationAsync(PushSubscription subscription, PushMessage message);
    Task SendNotificationAsync(PushSubscription subscription, PushMessage message, CancellationToken cancellationToken);
}
public class WebPushNotificationService : IPushNotificationService
{
    private readonly PushServiceClient _pushClient;
    private readonly IServiceScopeFactory _serviceScopeFactory;
    private readonly ILogger _logger;

    public WebPushNotificationService(PushServiceClient pushClient, IServiceScopeFactory serviceScopeFactory, ILogger<WebPushNotificationService> logger)
    {
        _pushClient = pushClient;
        _serviceScopeFactory = serviceScopeFactory;
        _logger = logger;
    }

    public Task SendNotificationAsync(PushSubscription subscription, PushMessage message)
    {
        return SendNotificationAsync(subscription, message, CancellationToken.None);
    }

    public async Task SendNotificationAsync(PushSubscription subscription, PushMessage message, CancellationToken cancellationToken)
    {
        try
        {
            await _pushClient.RequestPushMessageDeliveryAsync(subscription, message, cancellationToken);
        }
        catch (Exception ex)
        {
            await HandlePushMessageDeliveryExceptionAsync(ex, subscription);
        }
    }

    private async Task HandlePushMessageDeliveryExceptionAsync(Exception exception, PushSubscription subscription)
    {
        PushServiceClientException pushServiceClientException = exception as PushServiceClientException;

        if (pushServiceClientException is null)
        {
            _logger?.LogError(exception, "Failed requesting push message delivery to {0}.", subscription.Endpoint);
        }
        else
        {
            if ((pushServiceClientException.StatusCode == HttpStatusCode.NotFound) || (pushServiceClientException.StatusCode == HttpStatusCode.Gone))
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var pushSubscriptionStore = scope.ServiceProvider.GetRequiredService<IPushSubscriptionStore>();
                await pushSubscriptionStore.RemoveSubscriptionAsync(subscription.Endpoint);
                _logger?.LogInformation("Subscription has expired or is no longer valid and has been removed.");
            }
        }
    }
}