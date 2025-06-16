using Cliq.Server.Data;
using Cliq.Server.Models;
using Cliq.Server.Services.PushNotifications;
using Microsoft.EntityFrameworkCore;

namespace Cliq.Server.Services;

/// <summary>
/// Service for sending notifications for various application events
/// </summary>
public interface IEventNotificationService
{
    Task SendFriendRequestNotificationAsync(Guid requesterId, Guid addresseeId, Guid friendshipId);
    Task SendFriendRequestAcceptedNotificationAsync(Guid accepterId, Guid requesterId);
    Task SendNewPostNotificationAsync(Guid postId, Guid authorId, string postText, IEnumerable<Guid> circleIds);
    Task SendNewCommentNotificationAsync(Guid commentId, Guid postId, Guid postAuthorId, Guid commenterId, string commentText);
    Task SendCommentReplyNotificationAsync(Guid replyId, Guid postId, Guid parentCommentId, Guid parentCommentAuthorId, Guid replierId, string replyText);
    Task SendAppAnnouncementAsync(string title, string body, string? actionUrl = null);
}

public class EventNotificationService : IEventNotificationService
{
    private readonly IPushNotificationQueueService _notificationQueue;
    private readonly CliqDbContext _dbContext;

    public EventNotificationService(IPushNotificationQueueService notificationQueue, CliqDbContext dbContext)
    {
        _notificationQueue = notificationQueue;
        _dbContext = dbContext;
    }

    public async Task SendFriendRequestNotificationAsync(Guid requesterId, Guid addresseeId, Guid friendshipId)
    {
        var requester = await GetUserNameAsync(requesterId);
        var notificationData = new FriendRequestNotificationData
        {
            RequesterId = requesterId,
            FriendshipId = friendshipId
        };

        await _notificationQueue.AddNotificationAsync(addresseeId, notificationData, requester);
    }

    public async Task SendFriendRequestAcceptedNotificationAsync(Guid accepterId, Guid requesterId)
    {
        var accepter = await GetUserNameAsync(accepterId);
        var notificationData = new FriendRequestAcceptedNotificationData
        {
            AccepterId = accepterId
        };

        await _notificationQueue.AddNotificationAsync(requesterId, notificationData, accepter);
    }

    public async Task SendNewPostNotificationAsync(Guid postId, Guid authorId, string postText, IEnumerable<Guid> circleIds)
    {
        var author = await GetUserNameAsync(authorId);
        var circleIdsList = circleIds.ToList();

        // Get all circle members excluding the author
        var recipientUserIds = await _dbContext.CircleMemberships
            .Where(cm => circleIdsList.Contains(cm.CircleId) && cm.UserId != authorId)
            .Select(cm => cm.UserId)
            .Distinct()
            .ToListAsync();

        if (recipientUserIds.Any())
        {
            var notificationData = new NewPostNotificationData
            {
                PostId = postId,
                AuthorId = authorId,
                PostText = postText
            };

            await _notificationQueue.AddNotificationBulkAsync(recipientUserIds, notificationData, author);
        }
    }

    public async Task SendNewCommentNotificationAsync(Guid commentId, Guid postId, Guid postAuthorId, Guid commenterId, string commentText)
    {
        // Don't notify if commenting on own post
        if (postAuthorId == commenterId) return;

        var commenter = await GetUserNameAsync(commenterId);
        var notificationData = new NewCommentNotificationData
        {
            CommentId = commentId,
            PostId = postId,
            CommenterId = commenterId,
            CommentText = commentText
        };

        await _notificationQueue.AddNotificationAsync(postAuthorId, notificationData, commenter);
    }

    public async Task SendCommentReplyNotificationAsync(Guid replyId, Guid postId, Guid parentCommentId, Guid parentCommentAuthorId, Guid replierId, string replyText)
    {
        // Don't notify if replying to own comment
        if (parentCommentAuthorId == replierId) return;

        var replier = await GetUserNameAsync(replierId);
        var notificationData = new CommentReplyNotificationData
        {
            ReplyId = replyId,
            PostId = postId,
            ParentCommentId = parentCommentId,
            ReplierId = replierId,
            ReplyText = replyText
        };

        await _notificationQueue.AddNotificationAsync(parentCommentAuthorId, notificationData, replier);
    }

    public async Task SendAppAnnouncementAsync(string title, string body, string? actionUrl = null)
    {
        // Get all users
        var allUserIds = await _dbContext.Users
            .Select(u => u.Id)
            .ToListAsync();

        if (allUserIds.Any())
        {
            var notificationData = new AppAnnouncementNotificationData
            {
                Title = title,
                Body = body,
                ActionUrl = actionUrl
            };

            await _notificationQueue.AddNotificationBulkAsync(allUserIds, notificationData);
        }
    }

    private async Task<string> GetUserNameAsync(Guid userId)
    {
        var user = await _dbContext.Users.FindAsync(userId);
        return user?.Name ?? "Someone";
    }
}
