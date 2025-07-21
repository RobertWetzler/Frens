using Cliq.Server.Store;
using Lib.Net.Http.WebPush;
using Microsoft.Extensions.Options;

namespace Cliq.Server.Services.PushNotifications;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddNotificationServices(this IServiceCollection services, IConfiguration configuration)
    {
        // Configure push notification options
        services.Configure<PushNotificationOptions>(configuration.GetSection(PushNotificationOptions.SectionName));
        
        services.AddSingleton<WebPushNotificationService>();
        services.AddSingleton<IPushNotificationQueueService, PushNotificationQueueService>();
        services.AddSingleton<ISilentDbContextFactory, SilentDbContextFactory>();
        services.AddHostedService<PushNotificationsDequeuer>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<IPushSubscriptionStore, PushSubscriptionStore>();
        
        // Configure PushServiceClient with VAPID keys
        services.AddPushServiceClient(options =>
        {
            var pushNotificationOptions = configuration.GetSection(PushNotificationOptions.SectionName);
            
            // Get private key from environment variable in production, or from configuration in development
            var privateKey = Environment.GetEnvironmentVariable("VAPID_PRIVATE_KEY") ?? 
                           pushNotificationOptions.GetValue<string>(nameof(PushNotificationOptions.VapidPrivateKey));
            
            if (string.IsNullOrEmpty(privateKey))
            {
                throw new InvalidOperationException("VAPID private key is not configured. Set VAPID_PRIVATE_KEY environment variable or configure VapidPrivateKey in appsettings.");
            }
            
            options.Subject = pushNotificationOptions.GetValue<string>(nameof(PushNotificationOptions.VapidSubject));
            options.PublicKey = pushNotificationOptions.GetValue<string>(nameof(PushNotificationOptions.VapidPublicKey));
            options.PrivateKey = privateKey;
        });
        
        return services;
    }
}