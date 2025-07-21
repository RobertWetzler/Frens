
using Cliq.Server.Models;
using Lib.Net.Http.WebPush;

namespace Cliq.Server.Services.PushNotifications;

internal class PushNotificationsDequeuer : IHostedService
{
    private readonly IPushNotificationQueueService _notificationQueue;
    private readonly WebPushNotificationService _webPushNotificationService;
    private readonly ILogger<PushNotificationsDequeuer> _logger;
    private readonly CancellationTokenSource _stopTokenSource = new CancellationTokenSource();
    private Task _dequeueMessagesTask = Task.CompletedTask;
    private const int BATCH_SIZE = 1;
    private const int SLEEP_SECONDS = 1;

    public PushNotificationsDequeuer(
        IPushNotificationQueueService notificationQueue, 
        WebPushNotificationService webPushNotificationService,
        ILogger<PushNotificationsDequeuer> logger)
    {
        _notificationQueue = notificationQueue ?? throw new ArgumentNullException(nameof(notificationQueue));
        _webPushNotificationService = webPushNotificationService ?? throw new ArgumentNullException(nameof(webPushNotificationService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }
    public Task StartAsync(CancellationToken cancellationToken)
    {
        _dequeueMessagesTask = Task.Run(DequeueMessagesAsync);
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        _stopTokenSource.Cancel();
        return Task.WhenAny(_dequeueMessagesTask, Task.Delay(Timeout.Infinite, cancellationToken));
    }

    private async Task DequeueMessagesAsync()
    {
        while (!_stopTokenSource.IsCancellationRequested)
        {
            var messages = await _notificationQueue.DequeueAsync(BATCH_SIZE, _stopTokenSource.Token);
            if (messages.Count > 0)
            {
                _logger.LogInformation("Sending {NotificationCount} notifications", messages.Count);
            }
            while (messages.Count > 0 && !_stopTokenSource.IsCancellationRequested)
            {
                var message = messages[0];
                try
                {
                    // Process the message
                    await ProcessMessageAsync(message);
                    // Mark as sent
                    await _notificationQueue.MarkAsSentAsync(message.Id);
                }
                catch (Exception ex)
                {
                    // Log the error and mark as failed
                    _logger.LogError(ex, "Error processing notification message {MessageId}", message.Id);
                    await _notificationQueue.MarkAsFailedAsync(message.Id);
                }
                messages.RemoveAt(0); // Remove processed message
            }
            await Task.Delay(TimeSpan.FromSeconds(SLEEP_SECONDS));
        }
    }
    
    private async Task ProcessMessageAsync(NotificationDelivery notificationDelivery)
    {
        _logger.LogInformation("Processing notification {NotificationId} for endpoint {Endpoint}", 
            notificationDelivery.Id, notificationDelivery.PushSubscriptionEndpoint);
        var subscription = notificationDelivery.Subscription.ToPushSubscription();
        var notification = notificationDelivery.Notification;
        var payload = new
        {
            web_push = 8030,
            notification = new
            {
                title = notification.Title,
                body = notification.Message,
                navigate = notification.Navigate ?? "https://cliq-server.fly.dev",
                app_badge = notification.AppBadge ?? 0,
            }
        };
        var content = System.Text.Json.JsonSerializer.Serialize(payload);
        var message = new PushMessage(content);
        await _webPushNotificationService.SendNotificationAsync(subscription, message);
    }
}
