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

        await queueService.AddBulkAsync(userIds, notificationData);

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
        await queueService.AddBulkAsync(Array.Empty<Guid>(), notificationData);

        // Assert - no new notifications should be created
        var notificationCountAfter = await context.Set<Notification>().CountAsync();
        Assert.Equal(notificationCountBefore, notificationCountAfter);
    }
}
