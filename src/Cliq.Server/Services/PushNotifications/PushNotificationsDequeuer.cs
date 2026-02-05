using Cliq.Server.Models;
using Lib.Net.Http.WebPush;
using Microsoft.Extensions.Hosting;

namespace Cliq.Server.Services.PushNotifications;

internal class PushNotificationsDequeuer : BackgroundService
{
    private readonly IPushNotificationQueueService _notificationQueue;
    private readonly WebPushNotificationService _webPushNotificationService;
    private readonly ILogger<PushNotificationsDequeuer> _logger;
    private const int BATCH_SIZE = 10;
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

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("PushNotificationsDequeuer starting.");

        var idleDelay = TimeSpan.FromSeconds(SLEEP_SECONDS);
        var backoff = TimeSpan.FromSeconds(1);
        var maxBackoff = TimeSpan.FromMinutes(1);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var messages = await _notificationQueue.DequeueAsync(BATCH_SIZE, stoppingToken);

                if (messages.Count == 0)
                {
                    // Nothing to process; wait a bit before checking again
                    await Task.Delay(idleDelay, stoppingToken);
                    continue;
                }

                _logger.LogInformation("Sending {NotificationCount} notifications", messages.Count);

                foreach (var message in messages)
                {
                    if (stoppingToken.IsCancellationRequested) break;

                    try
                    {
                        // Process the message
                        await ProcessMessageAsync(message);
                        // Mark as sent
                        await _notificationQueue.MarkAsSentAsync(message.Id);
                    }
                    catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                    {
                        // Shutdown requested, exit gracefully
                        break;
                    }
                    catch (Exception ex)
                    {
                        // Log the error and mark as failed
                        _logger.LogError(ex, "Error processing notification message {MessageId}", message.Id);
                        await _notificationQueue.MarkAsFailedAsync(message.Id);
                    }
                }

                // Delay between batches
                if (stoppingToken.IsCancellationRequested) break;
                await Task.Delay(idleDelay, stoppingToken);

                // Successful iteration, reset backoff
                backoff = TimeSpan.FromSeconds(1);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // Graceful shutdown
                break;
            }
            catch (Exception ex)
            {
                // Catch-all to ensure the loop never dies on transient/unexpected errors
                _logger.LogError(ex, "Unhandled error in notification dequeue loop. Retrying with backoff.");

                try
                {
                    await Task.Delay(backoff, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }

                // Exponential backoff up to a cap
                var next = TimeSpan.FromMilliseconds(backoff.TotalMilliseconds * 2);
                backoff = next <= maxBackoff ? next : maxBackoff;
            }
        }

        _logger.LogInformation("PushNotificationsDequeuer stopping.");
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
                data = new
                {
                    url = notification.Navigate ?? "/"
                },
                app_badge = notification.AppBadge ?? 0,
            }
        };
        var content = System.Text.Json.JsonSerializer.Serialize(payload);
        var message = new PushMessage(content);
        await _webPushNotificationService.SendNotificationAsync(subscription, message);
    }
}
