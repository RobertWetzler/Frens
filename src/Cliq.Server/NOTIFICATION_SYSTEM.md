# Bulk Notification System

This document explains how to use the new bulk notification system implemented for Cliq.

## Overview

The notification system supports sending push notifications efficiently to multiple users for various events like:

- Friend requests
- Friend request acceptances  
- New posts
- New comments
- Comment replies
- App-wide announcements

## Key Components

### 1. Notification Types (`NotificationTypes.cs`)

Defines different types of notifications and their data structures:

```csharp
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
```

Each notification type has a corresponding `NotificationData` class that defines:
- The message format
- Metadata to be stored with the notification

### 2. Push Notification Queue Service (`PushNotificationQueue.cs`)

Enhanced with bulk operations:

```csharp
// Send to single user
await _notificationQueue.AddAsync(userId, message, metadata);

// Send to multiple users efficiently  
await _notificationQueue.AddBulkAsync(userIds, message, metadata);

// Send typed notifications (recommended)
await _notificationQueue.AddNotificationAsync(userId, notificationData, actorName);
await _notificationQueue.AddNotificationBulkAsync(userIds, notificationData, actorName);
```

### 3. Event Notification Service (`EventNotificationService.cs`)

High-level service for common notification scenarios:

```csharp
// Friend request sent
await _eventNotificationService.SendFriendRequestNotificationAsync(requesterId, addresseeId, friendshipId);

// Friend request accepted
await _eventNotificationService.SendFriendRequestAcceptedNotificationAsync(accepterId, requesterId);

// New post shared to circles
await _eventNotificationService.SendNewPostNotificationAsync(postId, authorId, postText, circleIds);

// App-wide announcement
await _eventNotificationService.SendAppAnnouncementAsync(title, body, actionUrl);
```

## Usage Examples

### 1. Friend Request Notifications

The `FriendshipService` automatically sends notifications when:
- A friend request is sent
- A friend request is accepted

```csharp
// In FriendshipService.SendFriendRequestAsync()
try
{
    _eventNotificationService?.SendFriendRequestNotificationAsync(requesterId, addresseeId, newFriendship.Id);
}
catch (Exception ex)
{
    // Log error but don't fail the friend request
    Console.WriteLine($"Failed to send friend request notification: {ex.Message}");
}
```

### 2. Post Notifications

The `PostService` sends notifications to circle members when a new post is created:

```csharp
// In PostService.CreatePostAsync()
try
{
    _eventNotificationService?.SendNewPostNotificationAsync(post.Id, userId, text, circleIds);
}
catch (Exception ex)
{
    _logger.LogWarning(ex, "Failed to send post notifications for post {PostId}", post.Id);
}
```

### 3. Custom Notifications

For custom scenarios, use the queue service directly:

```csharp
// Create custom notification data
var customNotification = new NewCommentNotificationData
{
    CommentId = commentId,
    PostId = postId,
    CommenterId = userId,
    CommentText = commentText
};

// Send to post author
await _notificationQueue.AddNotificationAsync(postAuthorId, customNotification, commenterName);
```

## Performance Benefits

### Bulk Operations
- **Single user**: 1 transaction, N subscription deliveries
- **Multiple users**: 1 transaction, all notifications and deliveries created together
- **Database efficiency**: Reduced round trips and transaction overhead

### Example Performance Comparison

**Old approach (N transactions):**
```csharp
foreach (var userId in userIds)
{
    await AddAsync(userId, message, metadata); // N database transactions
}
```

**New approach (1 transaction):**
```csharp
await AddBulkAsync(userIds, message, metadata); // 1 database transaction
```

For 100 users, this reduces from 100 database transactions to 1.

## Error Handling

Notifications are designed to be non-blocking:
- Failed notifications don't break core functionality
- Errors are logged but don't propagate
- Uses fire-and-forget pattern where appropriate

## Testing

Use the `NotificationTestController` for testing:

```bash
# Send app announcement
POST /api/notificationtest/announcement
{
  "title": "New Feature!",
  "body": "Check out our latest update",
  "actionUrl": "/updates"
}

# Send test friend request notification  
POST /api/notificationtest/test-friend-request
{
  "addresseeId": "user-guid-here"
}
```

## Integration Checklist

When adding notifications to a new feature:

1. ✅ Define notification type in `NotificationType` enum
2. ✅ Create corresponding `NotificationData` class
3. ✅ Add method to `IEventNotificationService` if needed
4. ✅ Inject `IEventNotificationService` into your service
5. ✅ Call notification method after successful operation
6. ✅ Wrap in try-catch to avoid breaking core functionality
7. ✅ Add tests for the notification behavior

## Future Enhancements

- **Notification preferences**: Allow users to opt out of certain notification types
- **Rate limiting**: Prevent spam notifications
- **Templates**: Rich notification templates with images and actions
- **Analytics**: Track notification delivery and engagement rates
- **Real-time updates**: WebSocket integration for instant UI updates
