using Xunit;
using Microsoft.EntityFrameworkCore;
using Cliq.Server.Data;
using Cliq.Server.Models;
using Cliq.Server.Services.PushNotifications;
using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;

namespace Cliq.Server.Test;

// Test implementation of ISilentDbContextFactory for testing
public class TestSilentDbContextFactory : ISilentDbContextFactory
{
    private readonly Func<CliqDbContext> _contextFactory;
    
    public TestSilentDbContextFactory(Func<CliqDbContext> contextFactory)
    {
        _contextFactory = contextFactory;
    }
    
    public CliqDbContext CreateContext()
    {
        return _contextFactory();
    }
}

[Collection("Database Tests")]
public class BulkNotificationTests : IClassFixture<DatabaseFixture>
{
    private readonly DatabaseFixture _fixture;
    
    public BulkNotificationTests(DatabaseFixture fixture)
    {
        _fixture = fixture;
    }

    private PushNotificationQueueService CreateQueueService(DatabaseFixture fixture)
    {
        var serviceCollection = new ServiceCollection();
        // Use a factory that creates new contexts from the fixture each time
        serviceCollection.AddScoped<CliqDbContext>(_ => fixture.CreateContext());
        var serviceProvider = serviceCollection.BuildServiceProvider();
        var scopeFactory = serviceProvider.GetRequiredService<IServiceScopeFactory>();
        var silentDbContextFactory = new TestSilentDbContextFactory(() => fixture.CreateContext());
        
        return new PushNotificationQueueService(scopeFactory, silentDbContextFactory);
    }

    [Fact]
    public async Task AddBulkAsync_CreatesNotificationsForMultipleUsers()
    {
        var context = _fixture.CreateContext();
        // Arrange
        var queueService = CreateQueueService(_fixture);

        // Use unique IDs for this test
        var userId1 = Guid.NewGuid();
        var userId2 = Guid.NewGuid();
        var endpoint1 = $"https://example.com/push/{Guid.NewGuid()}";
        var endpoint2 = $"https://example.com/push/{Guid.NewGuid()}";

        // Create test users and subscriptions
        var user1 = new User($"bulk1-{Guid.NewGuid()}@example.com") { Id = userId1, Name = "User 1" };
        var user2 = new User($"bulk2-{Guid.NewGuid()}@example.com") { Id = userId2, Name = "User 2" };

        var subscription1 = new EfPushSubscription
        {
            Id = Guid.NewGuid(),
            UserId = userId1,
            Endpoint = endpoint1,
            P256DH = "test_p256dh_1",
            Auth = "test_auth_1",
            CreatedAt = DateTime.UtcNow
        };

        var subscription2 = new EfPushSubscription
        {
            Id = Guid.NewGuid(),
            UserId = userId2,
            Endpoint = endpoint2,
            P256DH = "test_p256dh_2",
            Auth = "test_auth_2",
            CreatedAt = DateTime.UtcNow
        };

        context.Users.AddRange(user1, user2);
        context.Set<EfPushSubscription>().AddRange(subscription1, subscription2);
        await context.SaveChangesAsync();

        var userIds = new[] { userId1, userId2 };
        
        var notificationData = new AppAnnouncementNotificationData
        {
            AnnouncementTitle = "Test bulk message",
            Body = "test metadata"
        };

        await queueService.AddBulkAsync(context, userIds, notificationData);

        // Assert
        var notifications = await context.Set<Notification>()
            .Where(n => userIds.Contains(n.UserId ?? Guid.Empty))
            .ToListAsync();

        Assert.Equal(2, notifications.Count);
        Assert.All(notifications, n => Assert.Equal("test metadata", n.Message));
        Assert.All(notifications, n => Assert.Contains("AppAnnouncement", n.Metadata ?? ""));

        var deliveries = await context.Set<NotificationDelivery>()
            .Where(d => notifications.Select(n => n.Id).Contains(d.NotificationId))
            .ToListAsync();

        Assert.Equal(2, deliveries.Count);
        Assert.All(deliveries, d => Assert.Equal("pending", d.Status));
    }

    [Fact]
    public async Task AddNotificationAsync_WithTypedNotificationData_CreatesCorrectNotification()
    {
        var context = _fixture.CreateContext();
        // Arrange
        var queueService = CreateQueueService(_fixture);

        // Use unique IDs for this test
        var userId = Guid.NewGuid();
        var endpoint = $"https://example.com/push/{Guid.NewGuid()}";

        var user = new User($"typed-{Guid.NewGuid()}@example.com") { Id = userId, Name = "Test User" };
        var subscription = new EfPushSubscription
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Endpoint = endpoint,
            P256DH = "test_p256dh",
            Auth = "test_auth",
            CreatedAt = DateTime.UtcNow
        };

        context.Users.Add(user);
        context.Set<EfPushSubscription>().Add(subscription);
        await context.SaveChangesAsync();

        var notificationData = new FriendRequestNotificationData
        {
            RequesterId = Guid.NewGuid(),
            FriendshipId = Guid.NewGuid(),
            RequesterName = "John Doe"
        };

        // Act
        await queueService.AddAsync(userId, notificationData);

        // Assert
        var notifications = await context.Set<Notification>()
            .Where(n => n.UserId == userId)
            .ToListAsync();

        Assert.Single(notifications);
        var notification = notifications.First();
        Assert.Equal("sent you a friend request", notification.Message);
        Assert.Equal("John Doe", notification.Title);
        Assert.Contains("FriendRequest", notification.Metadata ?? "");
    }

    [Fact]
    public async Task AddBulkAsync_WithEmptyUserList_DoesNotCreateNotifications()
    {
        var context = _fixture.CreateContext();
        // Arrange
        var queueService = CreateQueueService(_fixture);

        // Count notifications before the operation
        var notificationCountBefore = await context.Set<Notification>().CountAsync();

        var notificationData = new AppAnnouncementNotificationData
        {
            AnnouncementTitle = "Test message",
            Body = "metadata"
        };

        // Act
        await queueService.AddBulkAsync(context, Array.Empty<Guid>(), notificationData);

        // Assert - no new notifications should be created
        var notificationCountAfter = await context.Set<Notification>().CountAsync();
        Assert.Equal(notificationCountBefore, notificationCountAfter);
    }

    [Fact]
    public async Task AddBulkAsync_WithOwnTransaction_CommitsAtomically()
    {
        var context = _fixture.CreateContext();
        // Arrange
        var queueService = CreateQueueService(_fixture);

        var userId = Guid.NewGuid();
        var endpoint = $"https://example.com/push/{Guid.NewGuid()}";

        var user = new User($"atomic-{Guid.NewGuid()}@example.com") { Id = userId, Name = "Test User" };
        var subscription = new EfPushSubscription
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Endpoint = endpoint,
            P256DH = "test_p256dh",
            Auth = "test_auth",
            CreatedAt = DateTime.UtcNow
        };

        context.Users.Add(user);
        context.Set<EfPushSubscription>().Add(subscription);
        await context.SaveChangesAsync();

        var notificationData = new AppAnnouncementNotificationData
        {
            AnnouncementTitle = "Test",
            Body = "Test body"
        };

        // Act - This will participate in context's transaction (if any)
        await queueService.AddBulkAsync(context, new[] { userId }, notificationData);

        // Assert - Verify notification and delivery were created atomically
        using var verifyContext = _fixture.CreateContext();
        var notifications = await verifyContext.Set<Notification>()
            .Where(n => n.UserId == userId && n.Message == "Test body")
            .ToListAsync();

        Assert.Single(notifications);

        var deliveries = await verifyContext.Set<NotificationDelivery>()
            .Where(d => d.NotificationId == notifications[0].Id)
            .ToListAsync();

        Assert.Single(deliveries);
        Assert.Equal("pending", deliveries[0].Status);
        Assert.Equal(endpoint, deliveries[0].PushSubscriptionEndpoint);
    }

    [Fact]
    public async Task AddBulkAsync_WithExistingDbContext_ParticipatesInTransaction()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        using var transaction = await context.Database.BeginTransactionAsync();

        var queueService = CreateQueueService(_fixture);

        var userId = Guid.NewGuid();
        var endpoint = $"https://example.com/push/{Guid.NewGuid()}";

        var user = new User($"tx-{Guid.NewGuid()}@example.com") { Id = userId, Name = "Test User" };
        var subscription = new EfPushSubscription
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Endpoint = endpoint,
            P256DH = "test_p256dh",
            Auth = "test_auth",
            CreatedAt = DateTime.UtcNow
        };

        context.Users.Add(user);
        context.Set<EfPushSubscription>().Add(subscription);
        await context.SaveChangesAsync();

        var notificationData = new AppAnnouncementNotificationData
        {
            AnnouncementTitle = "Test",
            Body = "Test body in transaction"
        };

        // Act - This should participate in the existing transaction
        await queueService.AddBulkAsync(context, new[] { userId }, notificationData);

        // Before commit, verify data is visible within transaction
        var notificationsInTransaction = await context.Set<Notification>()
            .Where(n => n.UserId == userId && n.Message == "Test body in transaction")
            .ToListAsync();
        Assert.Single(notificationsInTransaction);

        // Rollback the transaction
        await transaction.RollbackAsync();

        // Assert - After rollback, notification should NOT exist
        using var verifyContext = _fixture.CreateContext();
        var notificationsAfterRollback = await verifyContext.Set<Notification>()
            .Where(n => n.UserId == userId && n.Message == "Test body in transaction")
            .ToListAsync();

        Assert.Empty(notificationsAfterRollback);
    }

    [Fact]
    public async Task AddBulkAsync_WithExistingDbContext_CommitsWithTransaction()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        using var transaction = await context.Database.BeginTransactionAsync();

        var queueService = CreateQueueService(_fixture);

        var userId = Guid.NewGuid();
        var endpoint = $"https://example.com/push/{Guid.NewGuid()}";

        var user = new User($"commit-{Guid.NewGuid()}@example.com") { Id = userId, Name = "Test User" };
        var subscription = new EfPushSubscription
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Endpoint = endpoint,
            P256DH = "test_p256dh",
            Auth = "test_auth",
            CreatedAt = DateTime.UtcNow
        };

        context.Users.Add(user);
        context.Set<EfPushSubscription>().Add(subscription);
        await context.SaveChangesAsync();

        var notificationData = new AppAnnouncementNotificationData
        {
            AnnouncementTitle = "Test",
            Body = "Test body committed"
        };

        // Act - This should participate in the existing transaction
        await queueService.AddBulkAsync(context, new[] { userId }, notificationData);
        await transaction.CommitAsync();

        // Assert - After commit, notification SHOULD exist
        using var verifyContext = _fixture.CreateContext();
        var notificationsAfterCommit = await verifyContext.Set<Notification>()
            .Where(n => n.UserId == userId && n.Message == "Test body committed")
            .ToListAsync();

        Assert.Single(notificationsAfterCommit);

        var deliveries = await verifyContext.Set<NotificationDelivery>()
            .Where(d => d.NotificationId == notificationsAfterCommit[0].Id)
            .ToListAsync();

        Assert.Single(deliveries);
    }

    [Fact]
    public async Task AddBulkAsync_WithMultipleUsersAndMultipleSubscriptions_CreatesAllDeliveries()
    {
        var context = _fixture.CreateContext();
        // Arrange
        var queueService = CreateQueueService(_fixture);

        var userId1 = Guid.NewGuid();
        var userId2 = Guid.NewGuid();

        // User 1 has 2 subscriptions
        var user1 = new User($"multi1-{Guid.NewGuid()}@example.com") { Id = userId1, Name = "User 1" };
        var subscription1a = new EfPushSubscription
        {
            Id = Guid.NewGuid(),
            UserId = userId1,
            Endpoint = $"https://example.com/push/{Guid.NewGuid()}",
            P256DH = "test_p256dh_1a",
            Auth = "test_auth_1a",
            CreatedAt = DateTime.UtcNow
        };
        var subscription1b = new EfPushSubscription
        {
            Id = Guid.NewGuid(),
            UserId = userId1,
            Endpoint = $"https://example.com/push/{Guid.NewGuid()}",
            P256DH = "test_p256dh_1b",
            Auth = "test_auth_1b",
            CreatedAt = DateTime.UtcNow
        };

        // User 2 has 1 subscription
        var user2 = new User($"multi2-{Guid.NewGuid()}@example.com") { Id = userId2, Name = "User 2" };
        var subscription2 = new EfPushSubscription
        {
            Id = Guid.NewGuid(),
            UserId = userId2,
            Endpoint = $"https://example.com/push/{Guid.NewGuid()}",
            P256DH = "test_p256dh_2",
            Auth = "test_auth_2",
            CreatedAt = DateTime.UtcNow
        };

        context.Users.AddRange(user1, user2);
        context.Set<EfPushSubscription>().AddRange(subscription1a, subscription1b, subscription2);
        await context.SaveChangesAsync();

        var notificationData = new AppAnnouncementNotificationData
        {
            AnnouncementTitle = "Multiple subscriptions test",
            Body = "Test multi subs"
        };

        // Act
        await queueService.AddBulkAsync(context, new[] { userId1, userId2 }, notificationData);

        // Assert
        var notifications = await context.Set<Notification>()
            .Where(n => (n.UserId == userId1 || n.UserId == userId2) && n.Message == "Test multi subs")
            .ToListAsync();

        Assert.Equal(2, notifications.Count); // 2 notifications (one per user)

        var deliveries = await context.Set<NotificationDelivery>()
            .Where(d => notifications.Select(n => n.Id).Contains(d.NotificationId))
            .ToListAsync();

        Assert.Equal(3, deliveries.Count); // 3 deliveries total (2 for user1, 1 for user2)
        Assert.All(deliveries, d => Assert.Equal("pending", d.Status));
    }

    [Fact]
    public async Task AddBulkAsync_WithUserWithoutSubscriptions_CreatesNotificationButNoDeliveries()
    {
        var context = _fixture.CreateContext();
        // Arrange
        var queueService = CreateQueueService(_fixture);

        var userId = Guid.NewGuid();
        var user = new User($"nosub-{Guid.NewGuid()}@example.com") { Id = userId, Name = "User Without Subscription" };

        context.Users.Add(user);
        await context.SaveChangesAsync();

        var notificationData = new AppAnnouncementNotificationData
        {
            AnnouncementTitle = "Test no sub",
            Body = "Test body no sub"
        };

        // Act
        await queueService.AddBulkAsync(context, new[] { userId }, notificationData);

        // Assert - Notification should exist even without subscriptions (for in-app feed)
        var notifications = await context.Set<Notification>()
            .Where(n => n.UserId == userId && n.Message == "Test body no sub")
            .ToListAsync();

        Assert.Single(notifications);

        var deliveries = await context.Set<NotificationDelivery>()
            .Where(d => d.NotificationId == notifications[0].Id)
            .ToListAsync();

        Assert.Empty(deliveries); // No deliveries since no subscriptions
    }
}
