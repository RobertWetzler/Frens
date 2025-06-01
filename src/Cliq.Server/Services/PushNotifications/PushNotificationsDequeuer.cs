
using Cliq.Server.Models;
using Lib.Net.Http.WebPush;

namespace Cliq.Server.Services.PushNotifications;

internal class PushNotificationsDequeuer : IHostedService
{
    private readonly IPushNotificationQueueService _notificationQueue;
    private readonly WebPushNotificationService _webPushNotificationService;
    private readonly CancellationTokenSource _stopTokenSource = new CancellationTokenSource();
    private Task _dequeueMessagesTask;
    private const int BATCH_SIZE = 1;
    private const int SLEEP_SECONDS = 1;

    public PushNotificationsDequeuer(IPushNotificationQueueService notificationQueue, WebPushNotificationService webPushNotificationService)
    {
        _notificationQueue = notificationQueue ?? throw new ArgumentNullException(nameof(notificationQueue));
        _webPushNotificationService = webPushNotificationService ?? throw new ArgumentNullException(nameof(webPushNotificationService));
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
                    Console.WriteLine($"Error processing message {message.Id}: {ex.Message}");
                    await _notificationQueue.MarkAsFailedAsync(message.Id);
                }
                messages.RemoveAt(0); // Remove processed message
            }
        }
        await Task.Delay(TimeSpan.FromSeconds(SLEEP_SECONDS));
    }
    
    private async Task ProcessMessageAsync(NotificationDelivery notification)
    {
        Console.WriteLine($"Processing notification {notification.Id} for endpoint {notification.PushSubscriptionEndpoint}");
        var subscription = notification.Subscription.ToPushSubscription();
        var message = new PushMessage(notification.Notification.Message);
        await _webPushNotificationService.SendNotificationAsync(subscription, message);
    }
}
