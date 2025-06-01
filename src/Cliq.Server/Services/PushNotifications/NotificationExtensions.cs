using Cliq.Server.Store;
using Lib.Net.Http.WebPush;

namespace Cliq.Server.Services.PushNotifications;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddNotificationServices(this IServiceCollection services)
    {
        services.AddScoped<WebPushNotificationService>();
        services.AddScoped<IPushNotificationQueueService, PushNotificationQueueService>();
        services.AddScoped<PushNotificationsDequeuer>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<IPushSubscriptionStore, PushSubscriptionStore>();
        // This one comes from Lib.Net.Http.WebPush
        services.AddSingleton<PushServiceClient>();
        return services;
    }
}