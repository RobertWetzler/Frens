using Xunit;
using Microsoft.EntityFrameworkCore;
using Cliq.Server.Data;
using Cliq.Server.Models;
using Cliq.Server.Services;
using Cliq.Server.Services.PushNotifications;
using Microsoft.Extensions.Logging;
using AutoMapper;
using Moq;
using Microsoft.Extensions.DependencyInjection;

namespace Cliq.Server.Test;

/// <summary>
/// Integration tests for post creation with notifications to ensure atomicity
/// and avoid DbContext concurrency issues
/// </summary>
[Collection("Database Tests")]
public class PostNotificationIntegrationTests : IClassFixture<DatabaseFixture>
{
    private readonly DatabaseFixture _fixture;
    private readonly IMapper _mapper;

    public PostNotificationIntegrationTests(DatabaseFixture fixture)
    {
        _fixture = fixture;

        var mapperConfig = new MapperConfiguration(cfg =>
        {
            cfg.CreateMap<Post, PostDto>()
                .ForMember(dest => dest.SharedWithCircles, opt => opt.MapFrom(src =>
                    src.SharedWithCircles.Select(cp => new CirclePublicDto
                    {
                        Id = cp.CircleId,
                        Name = cp.Circle != null ? cp.Circle.Name : string.Empty,
                        IsShared = cp.Circle != null ? cp.Circle.IsShared : false,
                    })))
                .ForMember(dest => dest.SharedWithUsers, opt => opt.MapFrom(src =>
                    src.SharedWithUsers.Select(ip => new UserDto
                    {
                        Id = ip.UserId,
                        Name = ip.User != null ? ip.User.Name : string.Empty
                    })))
                .ForMember(dest => dest.HasImage, opt => opt.MapFrom(src => src.ImageObjectKeys.Any()))
                .ForMember(dest => dest.ImageCount, opt => opt.MapFrom(src => src.ImageObjectKeys.Count));
            cfg.CreateMap<User, UserDto>();
            cfg.CreateMap<Circle, CirclePublicDto>();
            cfg.CreateMap<Event, EventDto>()
                .ForMember(dest => dest.GoingCount, opt => opt.Ignore())
                .ForMember(dest => dest.MaybeCount, opt => opt.Ignore())
                .ForMember(dest => dest.NotGoingCount, opt => opt.Ignore())
                .ForMember(dest => dest.CurrentUserRsvp, opt => opt.Ignore());
            cfg.CreateMap<EventRsvp, EventRsvpDto>();
        });
        _mapper = mapperConfig.CreateMapper();
    }

    private (PostService postService, IEventNotificationService notificationService) CreateServices(CliqDbContext context)
    {
        var mockPostLogger = new Mock<ILogger<PostService>>();
        var mockCircleLogger = new Mock<ILogger<CircleService>>();
        var mockFriendshipLogger = new Mock<ILogger<FriendshipService>>();
        var mockCommentLogger = new Mock<ILogger<CommentService>>();
        var mockNotificationLogger = new Mock<ILogger<NotificationService>>();
        var mockStorageService = new Mock<IObjectStorageService>();
        var metricsService = new MetricsService();  // Use real instance, not mock
        var mockActivityService = new Mock<IUserActivityService>();

        // Create real notification services to test integration
        var serviceCollection = new ServiceCollection();
        serviceCollection.AddScoped<CliqDbContext>(_ => context);
        var serviceProvider = serviceCollection.BuildServiceProvider();
        var scopeFactory = serviceProvider.GetRequiredService<IServiceScopeFactory>();
        var silentDbContextFactory = new TestSilentDbContextFactory(() => _fixture.CreateContext());

        var queueService = new PushNotificationQueueService(scopeFactory, silentDbContextFactory);
        var eventNotificationService = new EventNotificationService(queueService, context);

        var friendshipService = new FriendshipService(context, _mapper, mockStorageService.Object, eventNotificationService);
        var commentService = new CommentService(context, _mapper, eventNotificationService, friendshipService, mockPostLogger.Object, mockActivityService.Object, mockStorageService.Object);
        var circleService = new CircleService(context, commentService, friendshipService, _mapper, eventNotificationService, mockCircleLogger.Object, mockStorageService.Object);
        var notificationService = new NotificationService(friendshipService, context, _mapper);

        var postService = new PostService(
            context,
            commentService,
            friendshipService,
            circleService,
            _mapper,
            mockPostLogger.Object,
            eventNotificationService,
            notificationService,
            mockStorageService.Object,
            metricsService,
            mockActivityService.Object
        );

        return (postService, eventNotificationService);
    }

    [Fact]
    public async Task CreatePost_WithCircle_CreatesNotificationsAtomically()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        var (postService, _) = CreateServices(context);

        var ownerId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var circleId = Guid.NewGuid();

        var owner = new User($"owner-{Guid.NewGuid()}@test.com") { Id = ownerId, Name = "Post Owner" };
        var member = new User($"member-{Guid.NewGuid()}@test.com") { Id = memberId, Name = "Circle Member" };

        var circle = new Circle
        {
            Id = circleId,
            Name = "Test Circle",
            OwnerId = ownerId,
            IsShared = false
        };

        var membership = new CircleMembership
        {
            CircleId = circleId,
            UserId = memberId
        };

        // Add subscription for the member so notifications can be delivered
        var subscription = new EfPushSubscription
        {
            Id = Guid.NewGuid(),
            UserId = memberId,
            Endpoint = $"https://example.com/push/{Guid.NewGuid()}",
            P256DH = "test_p256dh",
            Auth = "test_auth",
            CreatedAt = DateTime.UtcNow
        };

        context.Users.AddRange(owner, member);
        context.Circles.Add(circle);
        context.CircleMemberships.Add(membership);
        context.Set<EfPushSubscription>().Add(subscription);
        await context.SaveChangesAsync();

        // Act
        var postDto = await postService.CreatePostAsync(
            ownerId,
            new[] { circleId },
            Array.Empty<Guid>(),
            "Test post with notifications"
        );

        // Assert - Post was created
        Assert.NotNull(postDto);
        Assert.Equal("Test post with notifications", postDto.Text);

        // Assert - Notification was created for the circle member (not the owner)
        // Note: Metadata is JSONB, so we fetch all and filter in memory
        var allNotifications = await context.Set<Notification>()
            .Where(n => n.Metadata != null)
            .ToListAsync();
        var notifications = allNotifications
            .Where(n => n.Metadata!.Contains(postDto.Id.ToString()))
            .ToList();

        Assert.Single(notifications);
        Assert.Equal(memberId, notifications[0].UserId); // Only member gets notified, not owner
        Assert.Contains("Post Owner", notifications[0].Title);

        // Assert - Notification delivery was created
        var deliveries = await context.Set<NotificationDelivery>()
            .Where(d => d.NotificationId == notifications[0].Id)
            .ToListAsync();

        Assert.Single(deliveries);
        Assert.Equal("pending", deliveries[0].Status);
    }

    [Fact]
    public async Task CreatePost_TransactionRollback_DoesNotCreateNotifications()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        
        var ownerId = Guid.NewGuid();
        var circleOwnerId = Guid.NewGuid();
        var circleId = Guid.NewGuid();

        var owner = new User($"rollback-owner-{Guid.NewGuid()}@test.com") { Id = ownerId, Name = "Owner" };
        var circleOwner = new User($"rollback-circle-owner-{Guid.NewGuid()}@test.com") { Id = circleOwnerId, Name = "Circle Owner" };
        
        // Create circle owned by a different user - this will cause authorization to fail
        var circle = new Circle
        {
            Id = circleId,
            Name = "Someone Else's Circle",
            OwnerId = circleOwnerId,
            IsShared = false
        };

        context.Users.AddRange(owner, circleOwner);
        context.Circles.Add(circle);
        await context.SaveChangesAsync();

        var (postService, _) = CreateServices(context);

        // Act & Assert - Post creation should fail
        await Assert.ThrowsAsync<UnauthorizedAccessException>(async () =>
        {
            await postService.CreatePostAsync(
                ownerId,
                new[] { circleId },
                Array.Empty<Guid>(),
                "This should fail"
            );
        });

        // Assert - No post was created
        var posts = await context.Posts
            .Where(p => p.Text == "This should fail")
            .ToListAsync();
        Assert.Empty(posts);

        // Assert - No notifications were created
        var notifications = await context.Set<Notification>()
            .Where(n => n.Message != null && EF.Functions.Like(n.Message, "%This should fail%"))
            .ToListAsync();
        Assert.Empty(notifications);
    }

    [Fact]
    public async Task CreatePost_WithMultipleCircleMembers_CreatesNotificationForEach()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        var (postService, _) = CreateServices(context);

        var ownerId = Guid.NewGuid();
        var member1Id = Guid.NewGuid();
        var member2Id = Guid.NewGuid();
        var member3Id = Guid.NewGuid();
        var circleId = Guid.NewGuid();

        var owner = new User($"multi-owner-{Guid.NewGuid()}@test.com") { Id = ownerId, Name = "Owner" };
        var member1 = new User($"multi-member1-{Guid.NewGuid()}@test.com") { Id = member1Id, Name = "Member 1" };
        var member2 = new User($"multi-member2-{Guid.NewGuid()}@test.com") { Id = member2Id, Name = "Member 2" };
        var member3 = new User($"multi-member3-{Guid.NewGuid()}@test.com") { Id = member3Id, Name = "Member 3" };

        var circle = new Circle
        {
            Id = circleId,
            Name = "Multi Member Circle",
            OwnerId = ownerId,
            IsShared = false
        };

        var memberships = new[]
        {
            new CircleMembership { CircleId = circleId, UserId = member1Id },
            new CircleMembership { CircleId = circleId, UserId = member2Id },
            new CircleMembership { CircleId = circleId, UserId = member3Id }
        };

        context.Users.AddRange(owner, member1, member2, member3);
        context.Circles.Add(circle);
        context.CircleMemberships.AddRange(memberships);
        await context.SaveChangesAsync();

        // Act
        var postDto = await postService.CreatePostAsync(
            ownerId,
            new[] { circleId },
            Array.Empty<Guid>(),
            "Post for multiple members"
        );

        // Assert - 3 notifications created (one for each member, owner excluded)
        var allNotifications = await context.Set<Notification>()
            .Where(n => n.Metadata != null)
            .ToListAsync();
        var notifications = allNotifications
            .Where(n => n.Metadata!.Contains(postDto.Id.ToString()))
            .ToList();

        Assert.Equal(3, notifications.Count);
        Assert.All(notifications, n => Assert.NotEqual(ownerId, n.UserId)); // Owner should not get notification
        Assert.Contains(notifications, n => n.UserId == member1Id);
        Assert.Contains(notifications, n => n.UserId == member2Id);
        Assert.Contains(notifications, n => n.UserId == member3Id);
    }

    [Fact]
    public async Task CreatePost_ConcurrentCreation_NoDbContextConflicts()
    {
        // This test ensures that multiple posts can be created concurrently
        // without DbContext concurrency issues

        // Arrange
        var ownerId = Guid.NewGuid();
        var member1Id = Guid.NewGuid();
        var member2Id = Guid.NewGuid();
        var circleId = Guid.NewGuid();

        using (var setupContext = _fixture.CreateContext())
        {
            var owner = new User($"concurrent-owner-{Guid.NewGuid()}@test.com") { Id = ownerId, Name = "Owner" };
            var member1 = new User($"concurrent-member1-{Guid.NewGuid()}@test.com") { Id = member1Id, Name = "Member 1" };
            var member2 = new User($"concurrent-member2-{Guid.NewGuid()}@test.com") { Id = member2Id, Name = "Member 2" };

            var circle = new Circle
            {
                Id = circleId,
                Name = "Concurrent Test Circle",
                OwnerId = ownerId,
                IsShared = false
            };

            var memberships = new[]
            {
                new CircleMembership { CircleId = circleId, UserId = member1Id },
                new CircleMembership { CircleId = circleId, UserId = member2Id }
            };

            setupContext.Users.AddRange(owner, member1, member2);
            setupContext.Circles.Add(circle);
            setupContext.CircleMemberships.AddRange(memberships);
            await setupContext.SaveChangesAsync();
        }

        // Act - Create multiple posts in parallel
        var tasks = Enumerable.Range(0, 5).Select(async i =>
        {
            using var context = _fixture.CreateContext();
            var (postService, _) = CreateServices(context);

            return await postService.CreatePostAsync(
                ownerId,
                new[] { circleId },
                Array.Empty<Guid>(),
                $"Concurrent post {i}"
            );
        });

        var results = await Task.WhenAll(tasks);

        // Assert - All posts were created successfully
        Assert.Equal(5, results.Length);
        Assert.All(results, post => Assert.NotNull(post));
        Assert.All(results, post => Assert.NotEqual(Guid.Empty, post.Id));

        // Assert - All notifications were created
        using (var verifyContext = _fixture.CreateContext())
        {
            var postIds = results.Select(p => p.Id).ToList();
            // Query notifications by checking if Metadata contains any of the post IDs
            var notifications = await verifyContext.Set<Notification>()
                .Where(n => n.Metadata != null)
                .ToListAsync();
            
            // Filter in memory to check which notifications are for our posts
            var relevantNotifications = notifications
                .Where(n => postIds.Any(id => n.Metadata!.Contains(id.ToString())))
                .ToList();

            // Should be 10 notifications (2 members × 5 posts)
            Assert.Equal(10, relevantNotifications.Count);
        }
    }

    [Fact]
    public async Task CreatePost_WithNoCircleMembers_CreatesPostButNoNotifications()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        var (postService, _) = CreateServices(context);

        var ownerId = Guid.NewGuid();
        var circleId = Guid.NewGuid();

        var owner = new User($"alone-owner-{Guid.NewGuid()}@test.com") { Id = ownerId, Name = "Lonely Owner" };

        var circle = new Circle
        {
            Id = circleId,
            Name = "Empty Circle",
            OwnerId = ownerId,
            IsShared = false
        };

        context.Users.Add(owner);
        context.Circles.Add(circle);
        await context.SaveChangesAsync();

        // Act
        var postDto = await postService.CreatePostAsync(
            ownerId,
            new[] { circleId },
            Array.Empty<Guid>(),
            "Post to empty circle"
        );

        // Assert - Post was created
        Assert.NotNull(postDto);

        // Assert - No notifications created (owner doesn't notify themselves, no other members)
        var allNotifications = await context.Set<Notification>()
            .Where(n => n.Metadata != null)
            .ToListAsync();
        var notifications = allNotifications
            .Where(n => n.Metadata!.Contains(postDto.Id.ToString()))
            .ToList();

        Assert.Empty(notifications);
    }
}
