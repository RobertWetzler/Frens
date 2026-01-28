namespace Cliq.Server.Models;

/// <summary>
/// Enum defining different types of notifications in the system
/// </summary>
public enum NotificationType
{
    FriendRequest,
    FriendRequestAccepted,
    NewPost,
    NewEvent,
    NewComment,
    CommentReply,
    CarpoolReply,
    AppAnnouncement,
    PostMention,
    CommentMention,
    NewSubscribableCircle,
    NewSubscribableCircleNoFollow
}

/// <summary>
/// Base class for notification data that can be serialized to metadata JSON
/// </summary>
public abstract class NotificationData
{
    public NotificationType Type { get; set; }
    public virtual string Title { get; set; }
    public virtual string Message { get; set; }
    public virtual string Metadata { get; set; }
    public virtual string? Navigate => null;
}

/// <summary>
/// Notification data for friend requests
/// </summary>
public class FriendRequestNotificationData : NotificationData
{
    public Guid RequesterId { get; set; }
    public Guid FriendshipId { get; set; }
    public required string RequesterName { get; set; }

    public FriendRequestNotificationData()
    {
        Type = NotificationType.FriendRequest;
    }

    public override string Title
    {
        get => $"{RequesterName}";
        set { }
    }

    public override string Message
    {
        get => $"sent you a friend request";
        set { }
    }

    public override string Metadata
    {
        get => new
        {
            Type = Type.ToString(),
            RequesterId,
            FriendshipId
        }.ToJson();
        set { }
    }

    public override string? Navigate => "/notifications";
}

/// <summary>
/// Notification data for accepted friend requests
/// </summary>
public class FriendRequestAcceptedNotificationData : NotificationData
{
    public Guid AccepterId { get; set; }
    public required string AccepterName { get; set; }

    public FriendRequestAcceptedNotificationData()
    {
        Type = NotificationType.FriendRequestAccepted;
    }

    public override string Title
    {
        get => $"{AccepterName}";
        set { }
    }

    public override string Message
    {
        get => "accepted your friend request";
        set { }
    }

    public override string Metadata
    {
        get => new
        {
            Type = Type.ToString(),
            AccepterId
        }.ToJson();
        set { }
    }

    public override string? Navigate => "/notifications";
}

/// <summary>
/// Notification data for new posts
/// </summary>
public class NewPostNotificationData : NotificationData
{
    public Guid PostId { get; set; }
    public Guid AuthorId { get; set; }
    public required string AuthorName { get; set; }
    public string PostText { get; set; } = string.Empty;
    public bool HasImage { get; set; } = false;

    public NewPostNotificationData()
    {
        Type = NotificationType.NewPost;
    }

    public override string Title
    {
        get => $"{AuthorName}";
        set { }
    }

    public override string Message
    {
        get
        {
            return (HasImage ? "🖼️ " : "") + (PostText.Length > 100 ? PostText[..100] + "..." : PostText);
        }
        set { }
    }

    public override string Metadata
    {
        get => new
        {
            Type = Type.ToString(),
            PostId,
            AuthorId,
            PostText
        }.ToJson();
        set { }
    }

    public override string? Navigate => $"/post/{PostId}";
}

public class NewEventNotificationData : NotificationData
{
    public Guid EventId { get; set; }
    public Guid AuthorId { get; set; }
    public required string AuthorName { get; set; }
    public required string EventTitle { get; set; }

    public NewEventNotificationData()
    {
        Type = NotificationType.NewEvent;
    }

    public override string Title
    {
        get => $"{AuthorName} shared an event";
        set { }
    }

    public override string Message
    {
        get
        {
            return EventTitle.Length > 100 ? EventTitle[..100] + "..." : EventTitle;
        }
        set { }
    }

    public override string Metadata
    {
        get => new
        {
            Type = Type.ToString(),
            EventId,
            AuthorId,
            EventTitle
        }.ToJson();
        set { }
    }

    public override string? Navigate => "/calendar";
}

/// <summary>
/// Notification data for new comments
/// </summary>
public class NewCommentNotificationData : NotificationData
{
    public Guid CommentId { get; set; }
    public Guid PostId { get; set; }
    public Guid CommenterId { get; set; }
    public required string CommenterName { get; set; }
    public string CommentText { get; set; } = string.Empty;

    public NewCommentNotificationData()
    {
        Type = NotificationType.NewComment;
    }

    public override string Title
    {
        get => $"{CommenterName}";
        set { }
    }

    public override string Message
    {
        get => "commented: " + (CommentText.Length > 100 ? CommentText[..100] + "..." : CommentText);
        set { }
    }

    public override string Metadata
    {
        get => new
        {
            Type = Type.ToString(),
            CommentId,
            PostId,
            CommenterId,
            CommentText
        }.ToJson();
        set { }
    }

    public override string? Navigate => $"/post/{PostId}";
}

/// <summary>
/// Notification data for comment replies
/// </summary>
public class CommentReplyNotificationData : NotificationData
{
    public Guid ReplyId { get; set; }
    public Guid PostId { get; set; }
    public Guid ParentCommentId { get; set; }
    public Guid ReplierId { get; set; }
    public required string ReplierName { get; set; }
    public string ReplyText { get; set; } = string.Empty;

    public CommentReplyNotificationData()
    {
        Type = NotificationType.CommentReply;
    }

    public override string Title
    {
        get => $"{ReplierName}";
        set { }
    }

    public override string Message
    {
        get => "replied: " + (ReplyText.Length > 100 ? ReplyText[..100] + "..." : ReplyText);
        set { }
    }

    public override string Metadata
    {
        get => new
        {
            Type = Type.ToString(),
            ReplyId,
            PostId,
            ParentCommentId,
            ReplierId,
            ReplyText
        }.ToJson();
        set { }
    }

    public override string? Navigate => $"/post/{PostId}";
}

/// <summary>
/// Notification data for comment replies
/// </summary>
public class CarpoolReplyNotificationData : NotificationData
{
    public Guid PostId { get; set; }
    public Guid CommentId { get; set; }
    public string CommentText { get; set; } = string.Empty;
    public Guid CarpoolerId { get; set; }
    public required string CarpoolerName { get; set; }
    public bool IsOptIn { get; set; }

    public CarpoolReplyNotificationData()
    {
        Type = NotificationType.CarpoolReply;
    }

    public override string Title
    {
        get => $"{CarpoolerName}";
        set { }
    }

    public override string Message
    {
        get => (IsOptIn ? "joined" : "left") + " your carpool \"" + (CommentText.Length > 100 ? CommentText[..100] + "..." : CommentText) + "\"" ;
        set { }
    }

    public override string Metadata
    {
        get => new
        {
            Type = Type.ToString(),
            CommentId,
            PostId,
            CarpoolerId,
        }.ToJson();
        set { }
    }

    public override string? Navigate => $"/post/{PostId}";
}

/// <summary>
/// Notification data for app-wide announcements
/// </summary>
public class AppAnnouncementNotificationData : NotificationData
{
    public string AnnouncementTitle { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string? ActionUrl { get; set; }

    public AppAnnouncementNotificationData()
    {
        Type = NotificationType.AppAnnouncement;
    }

    public override string Title
    {
        get => AnnouncementTitle;
        set { }
    }

    public override string Message
    {
        get => Body;
        set { }
    }

    public override string Metadata
    {
        get => new
        {
            Type = Type.ToString(),
            Title = AnnouncementTitle,
            Body,
            ActionUrl
        }.ToJson();
        set { }
    }

    public override string? Navigate => ActionUrl ?? "/";
}

/// <summary>
/// Notification data for new posts
/// </summary>
public class NewSubscribableCircle : NotificationData
{
    public Guid AuthorId { get; set; }
    public required string AuthorName { get; set; }
    public required Guid CircleId { get; set; }
    public required string CircleName { get; set; }
    public bool IsAlreadyMember { get; set; }

    public NewSubscribableCircle()
    {
        Type = IsAlreadyMember ? NotificationType.NewSubscribableCircleNoFollow : NotificationType.NewSubscribableCircle;
    }

    public override string Title
    {
        get
        {
            if (IsAlreadyMember)
            {
                return $"{AuthorName} made a circle";
            }
            else
            {
                return $"Follow {AuthorName}'s new circle";
            }
        } 
        set { }
    }

    public override string Message
    {
        get => CircleName;
        set { }
    }

    public override string Metadata
    {
        get => new
        {
            Type = Type.ToString(),
            CircleId,
            CircleName,
            IsAlreadyMember,
            AuthorId,
            AuthorName
        }.ToJson();
        set { }
    }

    public override string? Navigate => "/circles";
}

/// <summary>
/// Notification data for when a user is mentioned/tagged in a post
/// </summary>
public class PostMentionNotificationData : NotificationData
{
    public Guid PostId { get; set; }
    public Guid AuthorId { get; set; }
    public required string AuthorName { get; set; }
    public string PostText { get; set; } = string.Empty;

    public PostMentionNotificationData()
    {
        Type = NotificationType.PostMention;
    }

    public override string Title
    {
        get => $"{AuthorName}";
        set { }
    }

    public override string Message
    {
        get => "mentioned you: " + (PostText.Length > 100 ? PostText[..100] + "..." : PostText);
        set { }
    }

    public override string Metadata
    {
        get => new
        {
            Type = Type.ToString(),
            PostId,
            AuthorId,
            PostText
        }.ToJson();
        set { }
    }

    public override string? Navigate => $"/post/{PostId}";
}

/// <summary>
/// Notification data for when a user is mentioned/tagged in a comment
/// </summary>
public class CommentMentionNotificationData : NotificationData
{
    public Guid CommentId { get; set; }
    public Guid PostId { get; set; }
    public Guid CommenterId { get; set; }
    public required string CommenterName { get; set; }
    public string CommentText { get; set; } = string.Empty;

    public CommentMentionNotificationData()
    {
        Type = NotificationType.CommentMention;
    }

    public override string Title
    {
        get => $"{CommenterName}";
        set { }
    }

    public override string Message
    {
        get => "mentioned you: " + (CommentText.Length > 100 ? CommentText[..100] + "..." : CommentText);
        set { }
    }

    public override string Metadata
    {
        get => new
        {
            Type = Type.ToString(),
            CommentId,
            PostId,
            CommenterId,
            CommentText
        }.ToJson();
        set { }
    }

    public override string? Navigate => $"/post/{PostId}";
}

public static class JsonExtensions
{
    public static string ToJson(this object obj)
    {
        return System.Text.Json.JsonSerializer.Serialize(obj);
    }
}
