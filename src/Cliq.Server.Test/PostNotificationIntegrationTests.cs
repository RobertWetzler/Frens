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
            cfg.CreateMap<InterestPost, InterestPublicDto>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Interest != null ? src.Interest.Id : src.InterestId))
                .ForMember(dest => dest.Name, opt => opt.MapFrom(src => src.Interest != null ? src.Interest.Name : string.Empty))
                .ForMember(dest => dest.DisplayName, opt => opt.MapFrom(src => src.Interest != null ? src.Interest.DisplayName : string.Empty));
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
        var mockInterestLogger = new Mock<ILogger<InterestService>>();
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
        var interestService = new InterestService(context, friendshipService, mockInterestLogger.Object, mockStorageService.Object);

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
            mockActivityService.Object,
            interestService
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

    [Fact]
    public async Task CreatePost_WithInterest_NotifiesFriendsWhoFollowInterest()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        var (postService, _) = CreateServices(context);

        var authorId = Guid.NewGuid();
        var friend1Id = Guid.NewGuid();
        var friend2Id = Guid.NewGuid();
        var nonFriendId = Guid.NewGuid();

        var author = new User($"interest-author-{Guid.NewGuid()}@test.com") { Id = authorId, Name = "Interest Author" };
        var friend1 = new User($"interest-friend1-{Guid.NewGuid()}@test.com") { Id = friend1Id, Name = "Friend 1" };
        var friend2 = new User($"interest-friend2-{Guid.NewGuid()}@test.com") { Id = friend2Id, Name = "Friend 2" };
        var nonFriend = new User($"interest-nonfriend-{Guid.NewGuid()}@test.com") { Id = nonFriendId, Name = "Non Friend" };

        context.Users.AddRange(author, friend1, friend2, nonFriend);

        // Create friendships (author <-> friend1, author <-> friend2)
        context.Friendships.AddRange(
            new Friendship { RequesterId = authorId, AddresseeId = friend1Id, Status = FriendshipStatus.Accepted, AcceptedAt = DateTime.UtcNow },
            new Friendship { RequesterId = authorId, AddresseeId = friend2Id, Status = FriendshipStatus.Accepted, AcceptedAt = DateTime.UtcNow }
        );

        // Create an interest and subscribe friend1 + nonFriend (but not friend2)
        var interest = new Interest { Id = Guid.NewGuid(), Name = "cooking", DisplayName = "Cooking", CreatedByUserId = authorId };
        context.Set<Interest>().Add(interest);

        context.InterestSubscriptions.AddRange(
            new InterestSubscription { InterestId = interest.Id, UserId = friend1Id },
            new InterestSubscription { InterestId = interest.Id, UserId = nonFriendId }
        );

        await context.SaveChangesAsync();

        // Act - Create post with interest
        var postDto = await postService.CreatePostAsync(
            authorId,
            Array.Empty<Guid>(),   // no circles
            Array.Empty<Guid>(),   // no direct users
            "Check out my cooking post!",
            interestNames: new[] { "cooking" }
        );

        // Assert - Only friend1 should get notified (follows interest AND is friend)
        // nonFriend follows interest but is not a friend, so no notification
        // friend2 is a friend but does not follow the interest, so no notification
        var allNotifications = await context.Set<Notification>()
            .Where(n => n.Metadata != null)
            .ToListAsync();
        var notifications = allNotifications
            .Where(n => n.Metadata!.Contains(postDto.Id.ToString()))
            .ToList();

        Assert.Single(notifications);
        Assert.Equal(friend1Id, notifications[0].UserId);
    }

    [Fact]
    public async Task CreatePost_WithDirectUsers_NotifiesDirectRecipients()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        var (postService, _) = CreateServices(context);

        var authorId = Guid.NewGuid();
        var targetUserId = Guid.NewGuid();

        var author = new User($"direct-author-{Guid.NewGuid()}@test.com") { Id = authorId, Name = "Direct Author" };
        var targetUser = new User($"direct-target-{Guid.NewGuid()}@test.com") { Id = targetUserId, Name = "Target User" };

        context.Users.AddRange(author, targetUser);

        // Must be friends for direct sharing
        context.Friendships.Add(
            new Friendship { RequesterId = authorId, AddresseeId = targetUserId, Status = FriendshipStatus.Accepted, AcceptedAt = DateTime.UtcNow }
        );

        await context.SaveChangesAsync();

        // Act
        var postDto = await postService.CreatePostAsync(
            authorId,
            Array.Empty<Guid>(),      // no circles
            new[] { targetUserId },    // direct user
            "Direct message post"
        );

        // Assert - Target user gets notified
        var allNotifications = await context.Set<Notification>()
            .Where(n => n.Metadata != null)
            .ToListAsync();
        var notifications = allNotifications
            .Where(n => n.Metadata!.Contains(postDto.Id.ToString()))
            .ToList();

        Assert.Single(notifications);
        Assert.Equal(targetUserId, notifications[0].UserId);
    }

    [Fact]
    public async Task CreatePost_WithCircleAndInterestOverlap_NoDuplicateNotifications()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        var (postService, _) = CreateServices(context);

        var authorId = Guid.NewGuid();
        var friendId = Guid.NewGuid();
        var circleId = Guid.NewGuid();

        var author = new User($"overlap-author-{Guid.NewGuid()}@test.com") { Id = authorId, Name = "Overlap Author" };
        var friend = new User($"overlap-friend-{Guid.NewGuid()}@test.com") { Id = friendId, Name = "Overlap Friend" };

        context.Users.AddRange(author, friend);

        // Friendship
        context.Friendships.Add(
            new Friendship { RequesterId = authorId, AddresseeId = friendId, Status = FriendshipStatus.Accepted, AcceptedAt = DateTime.UtcNow }
        );

        // Circle with friend as member
        var circle = new Circle { Id = circleId, Name = "Overlap Circle", OwnerId = authorId, IsShared = false };
        context.Circles.Add(circle);
        context.CircleMemberships.Add(new CircleMembership { CircleId = circleId, UserId = friendId });

        // Interest that friend also follows
        var interest = new Interest { Id = Guid.NewGuid(), Name = "overlap_topic", DisplayName = "Overlap Topic", CreatedByUserId = authorId };
        context.Set<Interest>().Add(interest);
        context.InterestSubscriptions.Add(new InterestSubscription { InterestId = interest.Id, UserId = friendId });

        await context.SaveChangesAsync();

        // Act - Post to BOTH the circle and the interest
        var postDto = await postService.CreatePostAsync(
            authorId,
            new[] { circleId },
            Array.Empty<Guid>(),
            "Overlap test post",
            interestNames: new[] { "overlap_topic" }
        );

        // Assert - Friend should get exactly ONE notification, not two
        var allNotifications = await context.Set<Notification>()
            .Where(n => n.Metadata != null)
            .ToListAsync();
        var notifications = allNotifications
            .Where(n => n.Metadata!.Contains(postDto.Id.ToString()))
            .ToList();

        Assert.Single(notifications);
        Assert.Equal(friendId, notifications[0].UserId);
    }

    [Fact]
    public async Task CreatePost_WithAllThreeAudienceTypes_DeduplicatesNotifications()
    {
        // Arrange - One user appears in circle, follows interest, AND is a direct recipient
        using var context = _fixture.CreateContext();
        var (postService, _) = CreateServices(context);

        var authorId = Guid.NewGuid();
        var friendId = Guid.NewGuid();
        var circleOnlyId = Guid.NewGuid();
        var circleId = Guid.NewGuid();

        var author = new User($"all3-author-{Guid.NewGuid()}@test.com") { Id = authorId, Name = "Triple Author" };
        var friend = new User($"all3-friend-{Guid.NewGuid()}@test.com") { Id = friendId, Name = "Triple Friend" };
        var circleOnly = new User($"all3-circleonly-{Guid.NewGuid()}@test.com") { Id = circleOnlyId, Name = "Circle Only" };

        context.Users.AddRange(author, friend, circleOnly);

        // Friendships
        context.Friendships.AddRange(
            new Friendship { RequesterId = authorId, AddresseeId = friendId, Status = FriendshipStatus.Accepted, AcceptedAt = DateTime.UtcNow },
            new Friendship { RequesterId = authorId, AddresseeId = circleOnlyId, Status = FriendshipStatus.Accepted, AcceptedAt = DateTime.UtcNow }
        );

        // Circle with both friend and circleOnly
        var circle = new Circle { Id = circleId, Name = "All3 Circle", OwnerId = authorId, IsShared = false };
        context.Circles.Add(circle);
        context.CircleMemberships.AddRange(
            new CircleMembership { CircleId = circleId, UserId = friendId },
            new CircleMembership { CircleId = circleId, UserId = circleOnlyId }
        );

        // Interest that friend follows (but circleOnly does not)
        var interest = new Interest { Id = Guid.NewGuid(), Name = "triple_test", DisplayName = "Triple Test", CreatedByUserId = authorId };
        context.Set<Interest>().Add(interest);
        context.InterestSubscriptions.Add(new InterestSubscription { InterestId = interest.Id, UserId = friendId });

        await context.SaveChangesAsync();

        // Act - Post to circle + interest + direct user (friend)
        var postDto = await postService.CreatePostAsync(
            authorId,
            new[] { circleId },
            new[] { friendId },      // friend is also direct
            "All three audience types",
            interestNames: new[] { "triple_test" }
        );

        // Assert - friend appears in all 3 audiences but gets exactly 1 notification
        // circleOnly is only in the circle, gets 1 notification
        var allNotifications = await context.Set<Notification>()
            .Where(n => n.Metadata != null)
            .ToListAsync();
        var notifications = allNotifications
            .Where(n => n.Metadata!.Contains(postDto.Id.ToString()))
            .ToList();

        Assert.Equal(2, notifications.Count);
        Assert.Contains(notifications, n => n.UserId == friendId);
        Assert.Contains(notifications, n => n.UserId == circleOnlyId);
        // No duplicates
        Assert.Equal(notifications.Count, notifications.Select(n => n.UserId).Distinct().Count());
    }

    [Fact]
    public async Task CreatePost_WithInterest_SendsDiscoveryNotificationToNonFollowers()
    {
        // Arrange: Friend A posts to interest X. Friend B doesn't follow X.
        // Friend B should get a discovery notification.
        using var context = _fixture.CreateContext();
        var (postService, _) = CreateServices(context);

        var authorId = Guid.NewGuid();
        var friendBId = Guid.NewGuid();

        var author = new User($"disc-author-{Guid.NewGuid()}@test.com") { Id = authorId, Name = "Chef Alice" };
        var friendB = new User($"disc-friendb-{Guid.NewGuid()}@test.com") { Id = friendBId, Name = "Friend Bob" };

        context.Users.AddRange(author, friendB);

        // Friendship
        context.Friendships.Add(
            new Friendship { RequesterId = authorId, AddresseeId = friendBId, Status = FriendshipStatus.Accepted, AcceptedAt = DateTime.UtcNow }
        );

        // Create the interest but Friend B does NOT follow it
        var interest = new Interest { Id = Guid.NewGuid(), Name = "baking", DisplayName = "Baking", CreatedByUserId = authorId };
        context.Set<Interest>().Add(interest);

        await context.SaveChangesAsync();

        // Act
        var postDto = await postService.CreatePostAsync(
            authorId,
            Array.Empty<Guid>(),
            Array.Empty<Guid>(),
            "Just baked sourdough!",
            interestNames: new[] { "baking" }
        );

        // Assert - Friend B gets a discovery notification about the interest
        var allNotifications = await context.Set<Notification>()
            .Where(n => n.Metadata != null)
            .ToListAsync();
        var discoveryNotifications = allNotifications
            .Where(n => n.Metadata!.Contains("InterestDiscovery") && n.UserId == friendBId)
            .ToList();

        Assert.Single(discoveryNotifications);
        Assert.Contains("Baking", discoveryNotifications[0].Title);
        Assert.Contains("Chef Alice", discoveryNotifications[0].Title);

        // Assert - Tracking record was created
        var trackingRecord = await context.Set<InterestDiscoveryNotification>()
            .Where(d => d.RecipientUserId == friendBId && d.InterestId == interest.Id)
            .FirstOrDefaultAsync();

        Assert.NotNull(trackingRecord);
    }

    [Fact]
    public async Task CreatePost_WithInterest_DoesNotDoubleNotifyWithinCooldown()
    {
        // Arrange: Friend B was already notified about interest X recently.
        // A second post to X should NOT send another discovery notification.
        using var context = _fixture.CreateContext();
        var (postService, _) = CreateServices(context);

        var authorId = Guid.NewGuid();
        var friendBId = Guid.NewGuid();

        var author = new User($"cooldown-author-{Guid.NewGuid()}@test.com") { Id = authorId, Name = "Author" };
        var friendB = new User($"cooldown-friendb-{Guid.NewGuid()}@test.com") { Id = friendBId, Name = "Friend B" };

        context.Users.AddRange(author, friendB);
        context.Friendships.Add(
            new Friendship { RequesterId = authorId, AddresseeId = friendBId, Status = FriendshipStatus.Accepted, AcceptedAt = DateTime.UtcNow }
        );

        var interest = new Interest { Id = Guid.NewGuid(), Name = "yoga", DisplayName = "Yoga", CreatedByUserId = authorId };
        context.Set<Interest>().Add(interest);

        // Pre-existing tracking record (sent 5 days ago - within 30-day cooldown)
        context.Set<InterestDiscoveryNotification>().Add(new InterestDiscoveryNotification
        {
            RecipientUserId = friendBId,
            InterestId = interest.Id,
            SentAt = DateTime.UtcNow.AddDays(-5),
            FriendCount = 1
        });

        await context.SaveChangesAsync();

        // Act
        var postDto = await postService.CreatePostAsync(
            authorId,
            Array.Empty<Guid>(),
            Array.Empty<Guid>(),
            "Morning yoga session",
            interestNames: new[] { "yoga" }
        );

        // Assert - No new discovery notification (within cooldown)
        var allNotifications = await context.Set<Notification>()
            .Where(n => n.Metadata != null)
            .ToListAsync();
        var discoveryNotifications = allNotifications
            .Where(n => n.Metadata!.Contains("InterestDiscovery") && n.UserId == friendBId)
            .ToList();

        Assert.Empty(discoveryNotifications);
    }

    [Fact]
    public async Task CreatePost_WithInterest_ReNotifiesAfterCooldownExpires()
    {
        // Arrange: Friend B was notified about interest X 35 days ago (past 30-day cooldown).
        // A new post should re-notify with updated friend count.
        using var context = _fixture.CreateContext();
        var (postService, _) = CreateServices(context);

        var authorId = Guid.NewGuid();
        var friendBId = Guid.NewGuid();

        var author = new User($"renotify-author-{Guid.NewGuid()}@test.com") { Id = authorId, Name = "Renotify Author" };
        var friendB = new User($"renotify-friendb-{Guid.NewGuid()}@test.com") { Id = friendBId, Name = "Friend B" };

        context.Users.AddRange(author, friendB);
        context.Friendships.Add(
            new Friendship { RequesterId = authorId, AddresseeId = friendBId, Status = FriendshipStatus.Accepted, AcceptedAt = DateTime.UtcNow }
        );

        var interest = new Interest { Id = Guid.NewGuid(), Name = "running", DisplayName = "Running", CreatedByUserId = authorId };
        context.Set<Interest>().Add(interest);

        // Expired tracking record (35 days ago)
        context.Set<InterestDiscoveryNotification>().Add(new InterestDiscoveryNotification
        {
            RecipientUserId = friendBId,
            InterestId = interest.Id,
            SentAt = DateTime.UtcNow.AddDays(-35),
            FriendCount = 1
        });

        await context.SaveChangesAsync();

        // Act
        var postDto = await postService.CreatePostAsync(
            authorId,
            Array.Empty<Guid>(),
            Array.Empty<Guid>(),
            "5K this morning!",
            interestNames: new[] { "running" }
        );

        // Assert - Re-notified
        var allNotifications = await context.Set<Notification>()
            .Where(n => n.Metadata != null)
            .ToListAsync();
        var discoveryNotifications = allNotifications
            .Where(n => n.Metadata!.Contains("InterestDiscovery") && n.UserId == friendBId)
            .ToList();

        Assert.Single(discoveryNotifications);

        // Assert - Tracking record was updated (not duplicated)
        var trackingRecords = await context.Set<InterestDiscoveryNotification>()
            .Where(d => d.RecipientUserId == friendBId && d.InterestId == interest.Id)
            .ToListAsync();

        Assert.Single(trackingRecords);
        Assert.True(trackingRecords[0].SentAt > DateTime.UtcNow.AddMinutes(-1)); // Recently updated
    }

    [Fact]
    public async Task CreatePost_WithInterest_RespectsOptOutSetting()
    {
        // Arrange: Friend B has opted out of interest discovery notifications.
        using var context = _fixture.CreateContext();
        var (postService, _) = CreateServices(context);

        var authorId = Guid.NewGuid();
        var friendBId = Guid.NewGuid();

        var author = new User($"optout-author-{Guid.NewGuid()}@test.com") { Id = authorId, Name = "Author" };
        var friendB = new User($"optout-friendb-{Guid.NewGuid()}@test.com") { Id = friendBId, Name = "Friend B", DisableInterestDiscovery = true };

        context.Users.AddRange(author, friendB);
        context.Friendships.Add(
            new Friendship { RequesterId = authorId, AddresseeId = friendBId, Status = FriendshipStatus.Accepted, AcceptedAt = DateTime.UtcNow }
        );

        var interest = new Interest { Id = Guid.NewGuid(), Name = "gaming", DisplayName = "Gaming", CreatedByUserId = authorId };
        context.Set<Interest>().Add(interest);

        await context.SaveChangesAsync();

        // Act
        var postDto = await postService.CreatePostAsync(
            authorId,
            Array.Empty<Guid>(),
            Array.Empty<Guid>(),
            "New game review!",
            interestNames: new[] { "gaming" }
        );

        // Assert - No discovery notification because Friend B opted out
        var allNotifications = await context.Set<Notification>()
            .Where(n => n.Metadata != null)
            .ToListAsync();
        var discoveryNotifications = allNotifications
            .Where(n => n.Metadata!.Contains("InterestDiscovery") && n.UserId == friendBId)
            .ToList();

        Assert.Empty(discoveryNotifications);
    }

    [Fact]
    public async Task CreatePost_WithInterest_SkipsDiscoveryForFriendsAlreadyFollowing()
    {
        // Arrange: Friend B already follows the interest. No discovery needed.
        using var context = _fixture.CreateContext();
        var (postService, _) = CreateServices(context);

        var authorId = Guid.NewGuid();
        var friendBId = Guid.NewGuid();

        var author = new User($"follows-author-{Guid.NewGuid()}@test.com") { Id = authorId, Name = "Author" };
        var friendB = new User($"follows-friendb-{Guid.NewGuid()}@test.com") { Id = friendBId, Name = "Friend B" };

        context.Users.AddRange(author, friendB);
        context.Friendships.Add(
            new Friendship { RequesterId = authorId, AddresseeId = friendBId, Status = FriendshipStatus.Accepted, AcceptedAt = DateTime.UtcNow }
        );

        var interest = new Interest { Id = Guid.NewGuid(), Name = "photography", DisplayName = "Photography", CreatedByUserId = authorId };
        context.Set<Interest>().Add(interest);

        // Friend B already follows the interest
        context.InterestSubscriptions.Add(new InterestSubscription { InterestId = interest.Id, UserId = friendBId });

        await context.SaveChangesAsync();

        // Act
        var postDto = await postService.CreatePostAsync(
            authorId,
            Array.Empty<Guid>(),
            Array.Empty<Guid>(),
            "Sunset photo!",
            interestNames: new[] { "photography" }
        );

        // Assert - No discovery notification (already following)
        var allNotifications = await context.Set<Notification>()
            .Where(n => n.Metadata != null)
            .ToListAsync();
        var discoveryNotifications = allNotifications
            .Where(n => n.Metadata!.Contains("InterestDiscovery") && n.UserId == friendBId)
            .ToList();

        Assert.Empty(discoveryNotifications);
    }
}
