namespace Cliq.Server.Models;

/// <summary>
/// Enum defining different types of notifications in the system
/// </summary>
public enum NotificationType
{
    FriendRequest,
    FriendRequestAccepted,
    NewPost,
    NewComment,
    CommentReply,
    AppAnnouncement,
    PostMention,
    CommentMention
}

/// <summary>
/// Base class for notification data that can be serialized to metadata JSON
/// </summary>
public abstract class NotificationData
{
    public NotificationType Type { get; set; }
    public abstract string GetMessage(string? actorName = null);
    public abstract object GetMetadata();
}

/// <summary>
/// Notification data for friend requests
/// </summary>
public class FriendRequestNotificationData : NotificationData
{
    public Guid RequesterId { get; set; }
    public Guid FriendshipId { get; set; }

    public FriendRequestNotificationData()
    {
        Type = NotificationType.FriendRequest;
    }

    public override string GetMessage(string? actorName = null)
    {
        return $"{actorName ?? "Someone"} sent you a friend request";
    }

    public override object GetMetadata()
    {
        return new
        {
            Type = Type.ToString(),
            RequesterId,
            FriendshipId
        };
    }
}

/// <summary>
/// Notification data for accepted friend requests
/// </summary>
public class FriendRequestAcceptedNotificationData : NotificationData
{
    public Guid AccepterId { get; set; }

    public FriendRequestAcceptedNotificationData()
    {
        Type = NotificationType.FriendRequestAccepted;
    }

    public override string GetMessage(string? actorName = null)
    {
        return $"{actorName ?? "Someone"} accepted your friend request";
    }

    public override object GetMetadata()
    {
        return new
        {
            Type = Type.ToString(),
            AccepterId
        };
    }
}

/// <summary>
/// Notification data for new posts
/// </summary>
public class NewPostNotificationData : NotificationData
{
    public Guid PostId { get; set; }
    public Guid AuthorId { get; set; }
    public string PostText { get; set; } = string.Empty;

    public NewPostNotificationData()
    {
        Type = NotificationType.NewPost;
    }

    public override string GetMessage(string? actorName = null)
    {
        var preview = PostText.Length > 50 ? PostText[..50] + "..." : PostText;
        return $"{actorName ?? "Someone"} shared a new post: \"{preview}\"";
    }

    public override object GetMetadata()
    {
        return new
        {
            Type = Type.ToString(),
            PostId,
            AuthorId,
            PostText
        };
    }
}

/// <summary>
/// Notification data for new comments
/// </summary>
public class NewCommentNotificationData : NotificationData
{
    public Guid CommentId { get; set; }
    public Guid PostId { get; set; }
    public Guid CommenterId { get; set; }
    public string CommentText { get; set; } = string.Empty;

    public NewCommentNotificationData()
    {
        Type = NotificationType.NewComment;
    }

    public override string GetMessage(string? actorName = null)
    {
        return $"{actorName ?? "Someone"} commented on your post";
    }

    public override object GetMetadata()
    {
        return new
        {
            Type = Type.ToString(),
            CommentId,
            PostId,
            CommenterId,
            CommentText
        };
    }
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
    public string ReplyText { get; set; } = string.Empty;

    public CommentReplyNotificationData()
    {
        Type = NotificationType.CommentReply;
    }

    public override string GetMessage(string? actorName = null)
    {
        return $"{actorName ?? "Someone"} replied to your comment";
    }

    public override object GetMetadata()
    {
        return new
        {
            Type = Type.ToString(),
            ReplyId,
            PostId,
            ParentCommentId,
            ReplierId,
            ReplyText
        };
    }
}

/// <summary>
/// Notification data for app-wide announcements
/// </summary>
public class AppAnnouncementNotificationData : NotificationData
{
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string? ActionUrl { get; set; }

    public AppAnnouncementNotificationData()
    {
        Type = NotificationType.AppAnnouncement;
    }

    public override string GetMessage(string? actorName = null)
    {
        return $"{Title}: {Body}";
    }

    public override object GetMetadata()
    {
        return new
        {
            Type = Type.ToString(),
            Title,
            Body,
            ActionUrl
        };
    }
}
