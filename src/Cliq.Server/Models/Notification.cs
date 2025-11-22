using Lib.Net.Http.WebPush;

namespace Cliq.Server.Models;

// The notification exposed to the frontend Notifications feed
public class NotificationFeedDto
{
    public IEnumerable<FriendRequestDto> friendRequests { get; set; }
    public IEnumerable<NotificationDto> notifications { get; set; }
}

public class Notification
{
    public Guid Id { get; set; }
    public Guid? UserId { get; set; } = null!;
    public string Title { get; set; } = null!;
    public string Message { get; set; } = null!;
    public int? AppBadge { get; set; } = null!;
    public string? Navigate { get; set; } = null!;
    public string? Metadata { get; set; } // JSON
    public DateTime CreatedAt { get; set; }

    public List<NotificationDelivery> Deliveries { get; set; } = new();
}

public class NotificationDto
{
    public Guid Id { get; set; }
    public Guid? UserId { get; set; }
    public string Title { get; set; }
    public string Message { get; set; }
    public string? Metadata { get; set; } // JSON
    public DateTime CreatedAt { get; set; }
}


public class NotificationDelivery
{
    public Guid Id { get; set; }

    public Guid NotificationId { get; set; }
    public Notification Notification { get; set; } = null!;

    public Guid SubscriptionId { get; set; }
    public EfPushSubscription Subscription { get; set; } = null!;

    public string? PushSubscriptionEndpoint { get; set; }

    public string Status { get; set; } = "pending";
    public int Retries { get; set; }
    public DateTime CreatedAt { get; set; }

    public string? LockedBy { get; set; }
    public DateTime? LockedUntil { get; set; }
}


// The push subscription model for storing Web Push subscriptions
public class EfPushSubscription
{
    public Guid Id { get; set; } // Primary key
    public string Endpoint { get; set; }
    public string P256DH { get; set; }
    public string Auth { get; set; }
    public Guid? UserId { get; set; }  // nullable for anonymous users
    public User? User { get; set; }      // navigation property
    public DateTime CreatedAt { get; set; }

    public PushSubscription ToPushSubscription()
    {
        return new PushSubscription
        {
            Endpoint = this.Endpoint,
            Keys = new Dictionary<string, string>
            {
                ["p256dh"] = this.P256DH,
                ["auth"] = this.Auth
            }
        };
    }
}

// The incoming DTO for push subscriptions
public class PushSubscriptionDto
{
    public string Endpoint { get; set; }
    public string P256DH { get; set; }
    public string Auth { get; set; }
}
