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
    Task SendNewPostNotificationAsync(Guid postId, Guid authorId, string postText, IEnumerable<Guid> circleIds, string authorName, bool hasImage, IEnumerable<Guid>? excludeUserIds = null, IEnumerable<Guid>? interestIds = null, IEnumerable<Guid>? directUserIds = null);
    Task SendNewEventNotificationAsync(Guid eventId, Guid authorId, string title, IEnumerable<Guid> circleIds, string authorName);
    Task SendNewCommentNotificationAsync(Guid commentId, Guid postId, Guid postAuthorId, Guid commenterId, string commentText, string commenterName, IEnumerable<Guid>? excludeUserIds = null);
    Task SendCommentReplyNotificationAsync(Guid replyId, Guid postId, Guid parentCommentId, Guid parentCommentAuthorId, Guid replierId, string replyText, string commenterName, IEnumerable<Guid>? excludeUserIds = null);
    Task SendCarpoolReplyNotificationAsync(Guid postId, Guid commentId, Guid commentAuthorId, string commentText, Guid carpoolerId, string carpoolerName, bool isOptIn);
    Task SendAppAnnouncementAsync(string title, string body, string? actionUrl = null);
    Task SendNewSubscribableCircle(Guid authorId, string authorName, Guid circleId, string circleName, Guid[] recipients, Guid[] alreadyMembers);
    Task SendPostMentionNotificationsAsync(Guid postId, Guid authorId, string authorName, string postText, IEnumerable<Guid> mentionedUserIds);
    Task SendCommentMentionNotificationsAsync(Guid commentId, Guid postId, Guid commenterId, string commenterName, string commentText, IEnumerable<Guid> mentionedUserIds);
    Task SendInterestDiscoveryNotificationsAsync(Guid authorId, string authorName, Guid interestId, string interestName, string interestDisplayName);
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

    public async Task SendNewPostNotificationAsync(Guid postId, Guid authorId, string postText, IEnumerable<Guid> circleIds, string authorName, bool hasImage, IEnumerable<Guid>? excludeUserIds = null, IEnumerable<Guid>? interestIds = null, IEnumerable<Guid>? directUserIds = null)
    {
        var circleIdsList = circleIds.ToList();
        var excludeSet = excludeUserIds?.ToHashSet() ?? new HashSet<Guid>();
        excludeSet.Add(authorId); // Always exclude the author

        var allRecipientIds = new HashSet<Guid>();

        // 1. Circle members
        if (circleIdsList.Count > 0)
        {
            var circleRecipients = await _dbContext.CircleMemberships
                .Where(cm => circleIdsList.Contains(cm.CircleId) && !excludeSet.Contains(cm.UserId))
                .Select(cm => cm.UserId)
                .Distinct()
                .ToListAsync();
            allRecipientIds.UnionWith(circleRecipients);
        }

        // 2. Interest followers who are friends with the author
        var interestIdsList = interestIds?.ToList();
        if (interestIdsList != null && interestIdsList.Count > 0)
        {
            // Get the author's accepted friend IDs
            var friendIds = await _dbContext.Friendships
                .Where(f => f.Status == FriendshipStatus.Accepted &&
                    (f.RequesterId == authorId || f.AddresseeId == authorId))
                .Select(f => f.RequesterId == authorId ? f.AddresseeId : f.RequesterId)
                .ToListAsync();

            // Find friends who follow any of the post's interests
            var interestRecipients = await _dbContext.InterestSubscriptions
                .Where(s => interestIdsList.Contains(s.InterestId) &&
                    friendIds.Contains(s.UserId) &&
                    !excludeSet.Contains(s.UserId))
                .Select(s => s.UserId)
                .Distinct()
                .ToListAsync();
            allRecipientIds.UnionWith(interestRecipients);
        }

        // 3. Directly shared users
        var directUserIdsList = directUserIds?.ToList();
        if (directUserIdsList != null && directUserIdsList.Count > 0)
        {
            allRecipientIds.UnionWith(directUserIdsList.Where(id => !excludeSet.Contains(id)));
        }

        if (allRecipientIds.Count != 0)
        {
            var notificationData = new NewPostNotificationData
            {
                PostId = postId,
                AuthorId = authorId,
                AuthorName = authorName,
                PostText = postText,
                HasImage = hasImage
            };

            await _notificationQueue.AddBulkAsync(_dbContext, allRecipientIds.ToList(), notificationData);
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

    public async Task SendNewCommentNotificationAsync(Guid commentId, Guid postId, Guid postAuthorId, Guid commenterId, string commentText, string commenterName, IEnumerable<Guid>? excludeUserIds = null)
    {
        // Don't notify if commenting on own post
        if (postAuthorId == commenterId) return;
        
        // Don't notify if post author was mentioned (they'll get a mention notification instead)
        if (excludeUserIds?.Contains(postAuthorId) == true) return;

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

    public async Task SendCommentReplyNotificationAsync(Guid replyId, Guid postId, Guid parentCommentId, Guid parentCommentAuthorId, Guid replierId, string replyText, string replierName, IEnumerable<Guid>? excludeUserIds = null)
    {
        // Don't notify if replying to own comment
        if (parentCommentAuthorId == replierId) return;
        
        // Don't notify if parent comment author was mentioned (they'll get a mention notification instead)
        if (excludeUserIds?.Contains(parentCommentAuthorId) == true) return;

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

    public async Task SendPostMentionNotificationsAsync(Guid postId, Guid authorId, string authorName, string postText, IEnumerable<Guid> mentionedUserIds)
    {
        var userIdsList = mentionedUserIds.ToList();
        if (!userIdsList.Any())
            return;

        var notificationData = new PostMentionNotificationData
        {
            PostId = postId,
            AuthorId = authorId,
            AuthorName = authorName,
            PostText = postText
        };

        await _notificationQueue.AddBulkAsync(_dbContext, userIdsList, notificationData);
    }

    public async Task SendCommentMentionNotificationsAsync(Guid commentId, Guid postId, Guid commenterId, string commenterName, string commentText, IEnumerable<Guid> mentionedUserIds)
    {
        var userIdsList = mentionedUserIds.ToList();
        if (!userIdsList.Any())
            return;

        var notificationData = new CommentMentionNotificationData
        {
            CommentId = commentId,
            PostId = postId,
            CommenterId = commenterId,
            CommenterName = commenterName,
            CommentText = commentText
        };

        await _notificationQueue.AddBulkAsync(_dbContext, userIdsList, notificationData);
    }

    /// <summary>
    /// Sends interest discovery notifications to the author's friends who don't follow the interest.
    /// Respects per-user opt-out (DisableInterestDiscovery) and a 30-day cooldown per (user, interest).
    /// After cooldown, re-notifies with updated friend count.
    /// </summary>
    public async Task SendInterestDiscoveryNotificationsAsync(Guid authorId, string authorName, Guid interestId, string interestName, string interestDisplayName)
    {
        var cooldownDays = 30;
        var cooldownCutoff = DateTime.UtcNow.AddDays(-cooldownDays);

        // Get the author's accepted friend IDs
        var friendIds = await _dbContext.Friendships
            .Where(f => f.Status == FriendshipStatus.Accepted &&
                (f.RequesterId == authorId || f.AddresseeId == authorId))
            .Select(f => f.RequesterId == authorId ? f.AddresseeId : f.RequesterId)
            .ToListAsync();

        if (friendIds.Count == 0) return;

        // Find friends who DON'T follow this interest
        var friendsAlreadyFollowing = (await _dbContext.InterestSubscriptions
            .Where(s => s.InterestId == interestId && friendIds.Contains(s.UserId))
            .Select(s => s.UserId)
            .ToListAsync()).ToHashSet();

        var friendsNotFollowing = friendIds.Where(id => !friendsAlreadyFollowing.Contains(id) && id != authorId).ToList();
        if (friendsNotFollowing.Count == 0) return;

        // Exclude friends who have opted out of interest discovery notifications
        var optedOutUserIds = (await _dbContext.Users
            .Where(u => friendsNotFollowing.Contains(u.Id) && u.DisableInterestDiscovery)
            .Select(u => u.Id)
            .ToListAsync()).ToHashSet();

        friendsNotFollowing = friendsNotFollowing.Where(id => !optedOutUserIds.Contains(id)).ToList();
        if (friendsNotFollowing.Count == 0) return;

        // Check existing discovery notifications for this interest within cooldown period
        var recentlyNotified = (await _dbContext.InterestDiscoveryNotifications
            .Where(d => d.InterestId == interestId &&
                friendsNotFollowing.Contains(d.RecipientUserId) &&
                d.SentAt > cooldownCutoff)
            .Select(d => d.RecipientUserId)
            .ToListAsync()).ToHashSet();

        // For users past cooldown, get their old records to update
        var expiredRecords = await _dbContext.InterestDiscoveryNotifications
            .Where(d => d.InterestId == interestId &&
                friendsNotFollowing.Contains(d.RecipientUserId) &&
                d.SentAt <= cooldownCutoff)
            .ToListAsync();

        var expiredUserIds = expiredRecords.Select(d => d.RecipientUserId).ToHashSet();

        // Count how many of the author's friends post to this interest (for the "N friends" message)
        var friendsPostingCount = await _dbContext.InterestPosts
            .Where(ip => ip.InterestId == interestId)
            .Select(ip => ip.Post!.UserId)
            .Where(uid => friendIds.Contains(uid))
            .Distinct()
            .CountAsync();

        // Recipients = never-notified + expired-cooldown
        var newRecipients = friendsNotFollowing
            .Where(id => !recentlyNotified.Contains(id) && !expiredUserIds.Contains(id))
            .ToList();

        var reNotifyRecipients = expiredUserIds.ToList();

        var allRecipients = newRecipients.Concat(reNotifyRecipients).ToList();
        if (allRecipients.Count == 0) return;

        // Create/update tracking records
        foreach (var userId in newRecipients)
        {
            await _dbContext.InterestDiscoveryNotifications.AddAsync(new InterestDiscoveryNotification
            {
                RecipientUserId = userId,
                InterestId = interestId,
                SentAt = DateTime.UtcNow,
                FriendCount = Math.Max(1, friendsPostingCount)
            });
        }

        foreach (var record in expiredRecords)
        {
            record.SentAt = DateTime.UtcNow;
            record.FriendCount = Math.Max(1, friendsPostingCount);
        }

        // Send the notification
        var notificationData = new InterestDiscoveryNotificationData
        {
            InterestId = interestId,
            InterestName = interestName,
            InterestDisplayName = interestDisplayName,
            AuthorId = authorId,
            AuthorName = authorName,
            FriendCount = Math.Max(1, friendsPostingCount)
        };

        await _notificationQueue.AddBulkAsync(_dbContext, allRecipients, notificationData);
    }
}