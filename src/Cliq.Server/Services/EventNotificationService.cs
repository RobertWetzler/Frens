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
    Task SendFriendRequestNotificationAsync(Guid requesterId, Guid addresseeId, Guid friendshipId, string requesterName);
    Task SendFriendRequestAcceptedNotificationAsync(Guid accepterId, Guid requesterId, string requesterName);
    Task SendNewPostNotificationAsync(Guid postId, Guid authorId, string postText, IEnumerable<Guid> circleIds, string authorName, bool hasImage);
    Task SendNewEventNotificationAsync(Guid eventId, Guid authorId, string title, IEnumerable<Guid> circleIds, string authorName);
    Task SendNewCommentNotificationAsync(Guid commentId, Guid postId, Guid postAuthorId, Guid commenterId, string commentText, string commenterName);
    Task SendCommentReplyNotificationAsync(Guid replyId, Guid postId, Guid parentCommentId, Guid parentCommentAuthorId, Guid replierId, string replyText, string commenterName);
    Task SendCarpoolReplyNotificationAsync(Guid postId, Guid commentId, Guid commentAuthorId, string commentText, Guid carpoolerId, string carpoolerName, bool isOptIn);
    Task SendAppAnnouncementAsync(string title, string body, string? actionUrl = null);
    Task SendNewSubscribableCircle(Guid authorId, string authorName, Guid circleId, string circleName, Guid[] recipients, Guid[] alreadyMembers);

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

    public async Task SendFriendRequestNotificationAsync(Guid requesterId, Guid addresseeId, Guid friendshipId, string requesterName)
    {
        var notificationData = new FriendRequestNotificationData
        {
            RequesterId = requesterId,
            RequesterName = requesterName,
            FriendshipId = friendshipId
        };

        await _notificationQueue.AddAsync(addresseeId, notificationData);
    }

    public async Task SendFriendRequestAcceptedNotificationAsync(Guid accepterId, Guid requesterId, string accepterName)
    {
        var notificationData = new FriendRequestAcceptedNotificationData
        {
            AccepterId = accepterId,
            AccepterName = accepterName,
        };

        await _notificationQueue.AddAsync(requesterId, notificationData);
    }

    public async Task SendNewPostNotificationAsync(Guid postId, Guid authorId, string postText, IEnumerable<Guid> circleIds, string authorName, bool hasImage)
    {
        var circleIdsList = circleIds.ToList();

        // Get all circle members excluding the author
        var recipientUserIds = await _dbContext.CircleMemberships
            .Where(cm => circleIdsList.Contains(cm.CircleId) && cm.UserId != authorId)
            .Select(cm => cm.UserId)
            .Distinct()
            .ToListAsync();

        if (recipientUserIds.Count != 0)
        {
            var notificationData = new NewPostNotificationData
            {
                PostId = postId,
                AuthorId = authorId,
                AuthorName = authorName,
                PostText = postText,
                HasImage = hasImage
            };

            await _notificationQueue.AddBulkAsync(_dbContext, recipientUserIds, notificationData);
        }
    }

    public async Task SendNewEventNotificationAsync(Guid eventId, Guid authorId, string title, IEnumerable<Guid> circleIds, string authorName)
    {
        var circleIdsList = circleIds.ToList();

        // Get all circle members excluding the author
        var recipientUserIds = await _dbContext.CircleMemberships
            .Where(cm => circleIdsList.Contains(cm.CircleId) && cm.UserId != authorId)
            .Select(cm => cm.UserId)
            .Distinct()
            .ToListAsync();

        if (recipientUserIds.Count != 0)
        {
            var notificationData = new NewEventNotificationData
            {
                EventId = eventId,
                AuthorId = authorId,
                AuthorName = authorName,
                EventTitle = title
            };

            await _notificationQueue.AddBulkAsync(_dbContext, recipientUserIds, notificationData);
        }
    }

    public async Task SendNewCommentNotificationAsync(Guid commentId, Guid postId, Guid postAuthorId, Guid commenterId, string commentText, string commenterName)
    {
        // Don't notify if commenting on own post
        if (postAuthorId == commenterId) return;

        var notificationData = new NewCommentNotificationData
        {
            CommentId = commentId,
            PostId = postId,
            CommenterId = commenterId,
            CommenterName = commenterName,
            CommentText = commentText
        };

        await _notificationQueue.AddAsync(postAuthorId, notificationData);
    }

    public async Task SendCommentReplyNotificationAsync(Guid replyId, Guid postId, Guid parentCommentId, Guid parentCommentAuthorId, Guid replierId, string replyText, string replierName)
    {
        // Don't notify if replying to own comment
        if (parentCommentAuthorId == replierId) return;

        var notificationData = new CommentReplyNotificationData
        {
            ReplyId = replyId,
            PostId = postId,
            ParentCommentId = parentCommentId,
            ReplierId = replierId,
            ReplierName = replierName,
            ReplyText = replyText
        };

        await _notificationQueue.AddAsync(parentCommentAuthorId, notificationData);
    }

    public async Task SendCarpoolReplyNotificationAsync(Guid postId, Guid commentId, Guid commentAuthorId, string commentText, Guid carpoolerId, string carpoolerName, bool isOptIn)
    {
        // Don't notify if replying to own carpool
        if (commentAuthorId == carpoolerId) return;

        var notificationData = new CarpoolReplyNotificationData
        {
            PostId = postId,
            CommentId = commentId,
            CommentText = commentText,
            CarpoolerId = carpoolerId,
            CarpoolerName = carpoolerName,
            IsOptIn = isOptIn
        };

        await _notificationQueue.AddAsync(commentAuthorId, notificationData);
    }

    public async Task SendAppAnnouncementAsync(string title, string body, string? actionUrl = null)
    {
        // Get all users
        var allUserIds = await _dbContext.Users
            .Select(u => u.Id)
            .ToListAsync();

        if (allUserIds.Count != 0)
        {
            var notificationData = new AppAnnouncementNotificationData
            {
                Title = title,
                Body = body,
                ActionUrl = actionUrl
            };

            await _notificationQueue.AddBulkAsync(_dbContext, allUserIds, notificationData);
        }
    }

    public async Task SendNewSubscribableCircle(Guid authorId, string authorName, Guid circleId, string circleName, Guid[] recipients, Guid[] alreadyMembers)
    {
        if (recipients.Length != 0)
        {
            var notificationData = new NewSubscribableCircle
            {
                AuthorId = authorId,
                AuthorName = authorName,
                CircleId = circleId,
                CircleName = circleName,
                IsAlreadyMember = false
            };

            await _notificationQueue.AddBulkAsync(_dbContext, recipients, notificationData);
        }

        // For already members, notify them of the new circle but dont prompt to follow
        if (alreadyMembers.Length != 0)
        {
            var notificationData = new NewSubscribableCircle
            {
                AuthorId = authorId,
                AuthorName = authorName,
                CircleId = circleId,
                CircleName = circleName,
                IsAlreadyMember = true
            };
                        
            await _notificationQueue.AddBulkAsync(_dbContext, alreadyMembers, notificationData);

        }
    }
}