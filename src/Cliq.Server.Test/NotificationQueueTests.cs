using Cliq.Server.Data;
using Cliq.Server.Models;
using Cliq.Server.Services.PushNotifications;
using Cliq.Server.Store;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using System.Net;
using Lib.Net.Http.WebPush;

namespace Cliq.Server.Test;

[Collection("Database Tests")]
public class PushNotificationSystemTests : IClassFixture<DatabaseFixture>
{
    private readonly DatabaseFixture _fixture;
    private readonly Mock<PushServiceClient> _mockPushClient;
    private readonly Mock<PushSubscriptionStore> _mockSubscriptionStore;
    private readonly Mock<ILogger<WebPushNotificationService>> _mockLogger;

    // Test data
    private readonly Guid _userId1 = Guid.NewGuid();
    private readonly Guid _userId2 = Guid.NewGuid();
    private readonly string _endpoint1 = "https://fcm.googleapis.com/fcm/send/endpoint1";
    private readonly string _endpoint2 = "https://fcm.googleapis.com/fcm/send/endpoint2";
    private readonly string _endpoint3 = "https://fcm.googleapis.com/fcm/send/endpoint3";

    public PushNotificationSystemTests(DatabaseFixture fixture)
    {
        _fixture = fixture;
        _mockPushClient = new Mock<PushServiceClient>();
        _mockSubscriptionStore = new Mock<PushSubscriptionStore>();
        _mockLogger = new Mock<ILogger<WebPushNotificationService>>();

        SetupTestDataAsync().GetAwaiter().GetResult();
    }

    private async Task SetupTestDataAsync()
    {
        using var context = _fixture.CreateContext();

        // Clean existing data
        await CleanupTestDataAsync(context);

        // Create test users
        var users = new List<User>
        {
            new User("user1@example.com") { Id = _userId1, Name = "User One" },
            new User("user2@example.com") { Id = _userId2, Name = "User Two" }
        };
        context.Users.AddRange(users);

        // Create push subscriptions
        var subscriptions = new List<EfPushSubscription>
        {
            new EfPushSubscription
            {
                UserId = _userId1,
                Endpoint = _endpoint1,
                P256DH = "BKey1",
                Auth = "AuthKey1"
            },
            new EfPushSubscription
            {
                UserId = _userId1,
                Endpoint = _endpoint2,
                P256DH = "BKey2",
                Auth = "AuthKey2"
            },
            new EfPushSubscription
            {
                UserId = _userId2,
                Endpoint = _endpoint3,
                P256DH = "BKey3",
                Auth = "AuthKey3"
            }
        };
        context.Set<EfPushSubscription>().AddRange(subscriptions);

        await context.SaveChangesAsync();
    }

    private async Task CleanupTestDataAsync(CliqDbContext context)
    {
        // Clean in dependency order
        var deliveries = await context.Set<NotificationDelivery>().ToListAsync();
        context.RemoveRange(deliveries);

        var notifications = await context.Set<Notification>().ToListAsync();
        context.RemoveRange(notifications);

        var subscriptions = await context.Set<EfPushSubscription>()
            .Where(s => s.UserId == _userId1 || s.UserId == _userId2)
            .ToListAsync();
        context.RemoveRange(subscriptions);

        var users = await context.Users
            .Where(u => u.Id == _userId1 || u.Id == _userId2)
            .ToListAsync();
        context.RemoveRange(users);

        await context.SaveChangesAsync();
    }

    #region PushNotificationQueueService Tests

    [Fact]
    public async Task AddAsync_CreatesNotificationAndDeliveries_ForAllUserSubscriptions()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        var queueService = new PushNotificationQueueService(context);

        // Act
        await queueService.AddAsync(_userId1, "Test message", "metadata");

        // Assert
        var notifications = await context.Set<Notification>()
            .Where(n => n.UserId == _userId1)
            .ToListAsync();

        Assert.Single(notifications);
        var notification = notifications.First();
        Assert.Equal("Test message", notification.Message);
        Assert.Equal("metadata", notification.Metadata);

        var deliveries = await context.Set<NotificationDelivery>()
            .Where(d => d.NotificationId == notification.Id)
            .ToListAsync();

        Assert.Equal(2, deliveries.Count); // User1 has 2 subscriptions
    }

    [Fact]
    public async Task AddAsync_CreatesNoDeliveries_WhenUserHasNoSubscriptions()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        var queueService = new PushNotificationQueueService(context);
        var userWithoutSubs = Guid.NewGuid();

        // Create user without subscriptions
        context.Users.Add(new User("nosubs@example.com") { Id = userWithoutSubs, Name = "No Subs" });
        await context.SaveChangesAsync();

        // Act
        await queueService.AddAsync(userWithoutSubs, "Test message", "metadata");

        // Assert
        var notifications = await context.Set<Notification>()
            .Where(n => n.UserId == userWithoutSubs)
            .ToListAsync();

        Assert.Single(notifications);

        var deliveries = await context.Set<NotificationDelivery>()
            .Where(d => d.NotificationId == notifications.First().Id)
            .ToListAsync();

        Assert.Empty(deliveries);
    }

    #endregion

    #region WebPushNotificationService Tests

    [Fact]
    public async Task SendNotificationAsync_CallsPushClient_WhenDeliverySucceeds()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        
        // Setup successful push response
        _mockPushClient.Setup(x => x.RequestPushMessageDeliveryAsync(
            It.IsAny<PushSubscription>(), 
            It.IsAny<PushSubscription>(), It.IsAny<PushMessage>(), 
            It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PushMessageDeliveryResult(HttpStatusCode.OK, null));

        var webPushService = new WebPushNotificationService(_mockPushClient.Object, _mockLogger.Object);

        // Create a test delivery
        var notification = new Notification(_userId1, "Test message", "metadata");
        context.Set<Notification>().Add(notification);
        await context.SaveChangesAsync();

        var delivery = new NotificationDelivery(notification.Id, _endpoint1);
        context.Set<NotificationDelivery>().Add(delivery);
        await context.SaveChangesAsync();

        // Act
        var result = await webPushService.SendNotificationAsync(delivery, notification);

        // Assert
        Assert.True(result);
        _mockPushClient.Verify(x => x.RequestPushMessageDeliveryAsync(
            It.Is<PushMessage>(pm => pm.Endpoint == _endpoint1),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SendNotificationAsync_ReturnsFalse_WhenPushClientFails()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        
        // Setup failed push response
        _mockPushClient.Setup(x => x.RequestPushMessageDeliveryAsync(
            It.IsAny<PushSubscription>(), It.IsAny<PushMessage>(), 
            It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PushMessageDeliveryResult(HttpStatusCode.BadRequest, "Invalid endpoint"));

        var webPushService = new WebPushNotificationService(_mockPushClient.Object, _mockLogger.Object);

        // Create a test delivery
        var notification = new Notification(_userId1, "Test message", "metadata");
        context.Set<Notification>().Add(notification);
        await context.SaveChangesAsync();

        var delivery = new NotificationDelivery(notification.Id, _endpoint1);
        context.Set<NotificationDelivery>().Add(delivery);
        await context.SaveChangesAsync();

        // Act
        var result = await webPushService.SendNotificationAsync(delivery, notification);

        // Assert
        Assert.False(result);
    }

    #endregion

    #region PushNotificationsDequeuer Tests

    [Fact]
    public async Task ProcessPendingNotificationsAsync_ProcessesOnlyUnleasedDeliveries()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        
        _mockPushClient.Setup(x => x.RequestPushMessageDeliveryAsync(
            It.IsAny<PushSubscription>(), It.IsAny<PushMessage>(), 
            It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PushMessageDeliveryResult(HttpStatusCode.OK, null));

        var webPushService = new WebPushNotificationService(_mockPushClient.Object, _mockLogger.Object);
        var dequeuer = new PushNotificationsDequeuer(context, webPushService, _mockLogger.Object);

        // Create notifications and deliveries
        var notification = new Notification(_userId1, "Test message", "metadata");
        context.Set<Notification>().Add(notification);
        await context.SaveChangesAsync();

        var delivery1 = new NotificationDelivery(notification.Id, _endpoint1);
        var delivery2 = new NotificationDelivery(notification.Id, _endpoint2);
        
        // Lease one delivery (simulate another server processing it)
        delivery2.LeaseUntil = DateTime.UtcNow.AddMinutes(5);
        delivery2.LeasedBy = "other-server";

        context.Set<NotificationDelivery>().AddRange(delivery1, delivery2);
        await context.SaveChangesAsync();

        // Act
        await dequeuer.ProcessPendingNotificationsAsync("test-server", CancellationToken.None);

        // Assert - Only one delivery should be processed
        _mockPushClient.Verify(x => x.RequestPushMessageDeliveryAsync(
            It.IsAny<PushSubscription>(), It.IsAny<PushMessage>(), 
            It.IsAny<CancellationToken>()), Times.Once);

        // Verify lease state
        var updatedDeliveries = await context.Set<NotificationDelivery>()
            .Where(d => d.NotificationId == notification.Id)
            .ToListAsync();

        var processedDelivery = updatedDeliveries.First(d => d.Endpoint == _endpoint1);
        Assert.Equal(DeliveryStatus.Delivered, processedDelivery.Status);
        Assert.Null(processedDelivery.LeaseUntil);

        var leasedDelivery = updatedDeliveries.First(d => d.Endpoint == _endpoint2);
        Assert.Equal(DeliveryStatus.Pending, leasedDelivery.Status);
        Assert.NotNull(leasedDelivery.LeaseUntil);
    }

    [Fact]
    public async Task ProcessPendingNotificationsAsync_RetriesFailedDeliveries_UpToMaxAttempts()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        
        _mockPushClient.Setup(x => x.RequestPushMessageDeliveryAsync(
            It.IsAny<PushSubscription>(), It.IsAny<PushMessage>(), 
            It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PushMessageDeliveryResult(HttpStatusCode.BadRequest, "Failed"));

        var webPushService = new WebPushNotificationService(_mockPushClient.Object, _mockLogger.Object);
        var dequeuer = new PushNotificationsDequeuer(context, webPushService, _mockLogger.Object);

        // Create notification and delivery
        var notification = new Notification(_userId1, "Test message", "metadata");
        context.Set<Notification>().Add(notification);
        await context.SaveChangesAsync();

        var delivery = new NotificationDelivery(notification.Id, _endpoint1);
        context.Set<NotificationDelivery>().Add(delivery);
        await context.SaveChangesAsync();

        // Act - Process multiple times to trigger retries
        for (int i = 0; i < 4; i++) // Assuming max retries is 3
        {
            await dequeuer.ProcessPendingNotificationsAsync("test-server", CancellationToken.None);
            
            // Reload delivery to get updated attempt count
            await context.Entry(delivery).ReloadAsync();
        }

        // Assert
        var finalDelivery = await context.Set<NotificationDelivery>()
            .FirstAsync(d => d.Id == delivery.Id);

        Assert.Equal(DeliveryStatus.Failed, finalDelivery.Status);
        Assert.Equal(3, finalDelivery.Attempts); // Assuming max retries is 3
    }

    [Fact]
    public async Task ProcessPendingNotificationsAsync_ProcessesExpiredLeases()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        
        _mockPushClient.Setup(x => x.RequestPushMessageDeliveryAsync(
            It.IsAny<PushSubscription>(), It.IsAny<PushMessage>(), 
            It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PushMessageDeliveryResult(HttpStatusCode.OK, null));

        var webPushService = new WebPushNotificationService(_mockPushClient.Object, _mockLogger.Object);
        var dequeuer = new PushNotificationsDequeuer(context, webPushService, _mockLogger.Object);

        // Create notification and delivery with expired lease
        var notification = new Notification(_userId1, "Test message", "metadata");
        context.Set<Notification>().Add(notification);
        await context.SaveChangesAsync();

        var delivery = new NotificationDelivery(notification.Id, _endpoint1)
        {
            LeaseUntil = DateTime.UtcNow.AddMinutes(-1), // Expired lease
            LeasedBy = "old-server"
        };
        context.Set<NotificationDelivery>().Add(delivery);
        await context.SaveChangesAsync();

        // Act
        await dequeuer.ProcessPendingNotificationsAsync("test-server", CancellationToken.None);

        // Assert
        _mockPushClient.Verify(x => x.RequestPushMessageDeliveryAsync(
            It.IsAny<PushSubscription>(), It.IsAny<PushMessage>(), 
            It.IsAny<CancellationToken>()), Times.Once);

        var updatedDelivery = await context.Set<NotificationDelivery>()
            .FirstAsync(d => d.Id == delivery.Id);

        Assert.Equal(DeliveryStatus.Delivered, updatedDelivery.Status);
        Assert.Null(updatedDelivery.LeaseUntil);
        Assert.Null(updatedDelivery.LeasedBy);
    }

    [Fact]
    public async Task ProcessPendingNotificationsAsync_PreventsDoubleProcessing_WithMultipleServers()
    {
        // Arrange
        using var context1 = _fixture.CreateContext();
        using var context2 = _fixture.CreateContext();
        
        _mockPushClient.Setup(x => x.RequestPushMessageDeliveryAsync(
            It.IsAny<PushSubscription>(), It.IsAny<PushMessage>(), 
            It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PushMessageDeliveryResult(HttpStatusCode.OK, null));

        var webPushService = new WebPushNotificationService(_mockPushClient.Object, _mockLogger.Object);
        var dequeuer1 = new PushNotificationsDequeuer(context1, webPushService, _mockLogger.Object);
        var dequeuer2 = new PushNotificationsDequeuer(context2, webPushService, _mockLogger.Object);

        // Create notification and delivery
        var notification = new Notification(_userId1, "Test message", "metadata");
        context1.Set<Notification>().Add(notification);
        await context1.SaveChangesAsync();

        var delivery = new NotificationDelivery(notification.Id, _endpoint1);
        context1.Set<NotificationDelivery>().Add(delivery);
        await context1.SaveChangesAsync();

        // Act - Simulate two servers processing simultaneously
        var task1 = dequeuer1.ProcessPendingNotificationsAsync("server-1", CancellationToken.None);
        var task2 = dequeuer2.ProcessPendingNotificationsAsync("server-2", CancellationToken.None);

        await Task.WhenAll(task1, task2);

        // Assert - Should only be called once due to leasing mechanism
        _mockPushClient.Verify(x => x.RequestPushMessageDeliveryAsync(
            It.IsAny<PushSubscription>(), It.IsAny<PushMessage>(), 
            It.IsAny<CancellationToken>()), Times.Once);

        // Verify final state
        using var verifyContext = _fixture.CreateContext();
        var finalDelivery = await verifyContext.Set<NotificationDelivery>()
            .FirstAsync(d => d.Id == delivery.Id);

        Assert.Equal(DeliveryStatus.Delivered, finalDelivery.Status);
    }

    [Fact]
    public async Task ProcessPendingNotificationsAsync_HandlesLongRunningLeases_ViaExpiry()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        
        var webPushService = new WebPushNotificationService(_mockPushClient.Object, _mockLogger.Object);
        var dequeuer = new PushNotificationsDequeuer(context, webPushService, _mockLogger.Object);

        // Create notification and delivery with a lease that will expire
        var notification = new Notification(_userId1, "Test message", "metadata");
        context.Set<Notification>().Add(notification);
        await context.SaveChangesAsync();

        var delivery = new NotificationDelivery(notification.Id, _endpoint1)
        {
            LeaseUntil = DateTime.UtcNow.AddMilliseconds(100), // Very short lease
            LeasedBy = "slow-server"
        };
        context.Set<NotificationDelivery>().Add(delivery);
        await context.SaveChangesAsync();

        // Setup mock to succeed on second call (after lease expires)
        _mockPushClient.Setup(x => x.RequestPushMessageDeliveryAsync(
            It.IsAny<PushSubscription>(), It.IsAny<PushMessage>(), 
            It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PushMessageDeliveryResult(HttpStatusCode.OK, null));

        // Act - First call should not process (lease active)
        await dequeuer.ProcessPendingNotificationsAsync("test-server", CancellationToken.None);
        
        // Wait for lease to expire
        await Task.Delay(200);
        
        // Second call should process (lease expired)
        await dequeuer.ProcessPendingNotificationsAsync("test-server", CancellationToken.None);

        // Assert
        _mockPushClient.Verify(x => x.RequestPushMessageDeliveryAsync(
            It.IsAny<PushSubscription>(), It.IsAny<PushMessage>(), 
            It.IsAny<CancellationToken>()), Times.Once);

        var finalDelivery = await context.Set<NotificationDelivery>()
            .FirstAsync(d => d.Id == delivery.Id);

        Assert.Equal(DeliveryStatus.Delivered, finalDelivery.Status);
        Assert.Null(finalDelivery.LeaseUntil);
    }

    #endregion

    #region Integration Tests

    [Fact]
    public async Task EndToEnd_NotificationFlow_WorksCorrectly()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        
        _mockPushClient.Setup(x => x.RequestPushMessageDeliveryAsync(
            It.IsAny<PushSubscription>(), It.IsAny<PushMessage>(), 
            It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PushMessageDeliveryResult(HttpStatusCode.OK, null));

        var queueService = new PushNotificationQueueService(context);
        var webPushService = new WebPushNotificationService(_mockPushClient.Object, _mockLogger.Object);
        var dequeuer = new PushNotificationsDequeuer(context, webPushService, _mockLogger.Object);

        // Act - Add notification to queue
        await queueService.AddAsync(_userId1, "End-to-end test", "test-metadata");

        // Process the queue
        await dequeuer.ProcessPendingNotificationsAsync("test-server", CancellationToken.None);

        // Assert
        var notifications = await context.Set<Notification>()
            .Where(n => n.UserId == _userId1)
            .ToListAsync();

        Assert.Single(notifications);

        var deliveries = await context.Set<NotificationDelivery>()
            .Where(d => d.NotificationId == notifications.First().Id)
            .ToListAsync();

        Assert.Equal(2, deliveries.Count); // User1 has 2 subscriptions
        Assert.All(deliveries, d => Assert.Equal(DeliveryStatus.Delivered, d.Status));

        // Verify push client was called for each subscription
        _mockPushClient.Verify(x => x.RequestPushMessageDeliveryAsync(
            It.IsAny<PushSubscription>(), It.IsAny<PushMessage>(), 
            It.IsAny<CancellationToken>()), Times.Exactly(2));
    }

    #endregion
}