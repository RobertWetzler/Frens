namespace Cliq.Server.Services.PushNotifications;

public class PushNotificationOptions
{
    public const string SectionName = "PushNotifications";
    
    public string VapidSubject { get; set; } = string.Empty;
    public string VapidPublicKey { get; set; } = string.Empty;
    public string VapidPrivateKey { get; set; } = string.Empty;
}
