using Cliq.Server.Data;
using Cliq.Server.Models;
using Cliq.Server.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using AutoMapper;
using Xunit.Abstractions;

namespace Cliq.Server.Test;

/// <summary>
/// Tests for recommended friends and circles in the feed response.
/// Validates that recommendations are only returned on the first page.
/// </summary>
[Collection("Database Tests")]
public class FeedRecommendationsTests : IClassFixture<DatabaseFixture>
{
    private readonly DatabaseFixture _fixture;
    private readonly IMapper _mapper;
    private readonly Mock<ILogger<PostService>> _mockPostLogger;
    private readonly Mock<ILogger<CircleService>> _mockCircleLogger;
    private readonly Mock<ICommentService> _mockCommentService;
    private readonly Mock<IEventNotificationService> _mockEventNotificationService;
    private readonly Mock<IObjectStorageService> _mockStorageService;
    private readonly ITestOutputHelper _output;

    // Test users
    private readonly Guid _mainUserId = Guid.NewGuid();
    private readonly Guid _friend1Id = Guid.NewGuid();
    private readonly Guid _friend2Id = Guid.NewGuid();
    private readonly Guid _friend3Id = Guid.NewGuid();
    
    // Friends-of-friends (for recommendation testing)
    private readonly Guid _fof1Id = Guid.NewGuid(); // 2 mutual friends
    private readonly Guid _fof2Id = Guid.NewGuid(); // 3 mutual friends
    
    // Circle for testing subscribable circles
    private readonly Guid _subscribableCircleId = Guid.NewGuid();

    public FeedRecommendationsTests(DatabaseFixture fixture, ITestOutputHelper output)
    {
        _fixture = fixture;
        _output = output;

        // Setup AutoMapper
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
            cfg.CreateMap<Comment, CommentDto>()
                .ForMember(dest => dest.Replies, opt => opt.Ignore());
            cfg.CreateMap<Circle, CirclePublicDto>();
            cfg.CreateMap<Event, EventDto>()
                .ForMember(dest => dest.GoingCount, opt => opt.Ignore())
                .ForMember(dest => dest.MaybeCount, opt => opt.Ignore())
                .ForMember(dest => dest.NotGoingCount, opt => opt.Ignore())
                .ForMember(dest => dest.CurrentUserRsvp, opt => opt.Ignore());
            cfg.CreateMap<EventRsvp, EventRsvpDto>();
        });
        _mapper = mapperConfig.CreateMapper();

        // Setup mocks
        _mockPostLogger = new Mock<ILogger<PostService>>();
        _mockCircleLogger = new Mock<ILogger<CircleService>>();
        _mockCommentService = new Mock<ICommentService>();
        _mockEventNotificationService = new Mock<IEventNotificationService>();
        _mockStorageService = new Mock<IObjectStorageService>();
        
        _mockCommentService.Setup(x => x.GetAllCommentsForPostAsync(It.IsAny<Guid>()))
            .ReturnsAsync(new List<CommentDto>());
        
        _mockStorageService.Setup(s => s.GetProfilePictureUrl(It.IsAny<string>()))
            .Returns((string key) => $"https://storage.example.com/{key}");

        SetupTestDataAsync().GetAwaiter().GetResult();
    }

    private async Task SetupTestDataAsync()
    {
        using var context = _fixture.CreateContext();
        
        await CleanupTestDataAsync(context);
        
        // Create users
        var users = new List<User>
        {
            new User("main@test.com") { Id = _mainUserId, Name = "Main User" },
            new User("friend1@test.com") { Id = _friend1Id, Name = "Friend One" },
            new User("friend2@test.com") { Id = _friend2Id, Name = "Friend Two" },
            new User("friend3@test.com") { Id = _friend3Id, Name = "Friend Three" },
            new User("fof1@test.com") { Id = _fof1Id, Name = "FoF One (2 mutual)" },
            new User("fof2@test.com") { Id = _fof2Id, Name = "FoF Two (3 mutual)" }
        };
        context.Users.AddRange(users);
        
        // Create friendships - main user is friends with friend1, friend2, friend3
        var friendships = new List<Friendship>
        {
            new Friendship { RequesterId = _mainUserId, AddresseeId = _friend1Id, Status = FriendshipStatus.Accepted },
            new Friendship { RequesterId = _mainUserId, AddresseeId = _friend2Id, Status = FriendshipStatus.Accepted },
            new Friendship { RequesterId = _mainUserId, AddresseeId = _friend3Id, Status = FriendshipStatus.Accepted },
            
            // FoF1 is friends with friend1 and friend2 (2 mutual with main)
            new Friendship { RequesterId = _friend1Id, AddresseeId = _fof1Id, Status = FriendshipStatus.Accepted },
            new Friendship { RequesterId = _friend2Id, AddresseeId = _fof1Id, Status = FriendshipStatus.Accepted },
            
            // FoF2 is friends with friend1, friend2, and friend3 (3 mutual with main)
            new Friendship { RequesterId = _friend1Id, AddresseeId = _fof2Id, Status = FriendshipStatus.Accepted },
            new Friendship { RequesterId = _friend2Id, AddresseeId = _fof2Id, Status = FriendshipStatus.Accepted },
            new Friendship { RequesterId = _friend3Id, AddresseeId = _fof2Id, Status = FriendshipStatus.Accepted }
        };
        context.Friendships.AddRange(friendships);
        
        // Create a subscribable circle owned by friend1 (main user is NOT a member)
        var subscribableCircle = new Circle
        {
            Id = _subscribableCircleId,
            Name = "Friend's Public Circle",
            OwnerId = _friend1Id,
            IsSubscribable = true
        };
        context.Circles.Add(subscribableCircle);
        
        // Add friend1 as a member of their own circle
        context.CircleMemberships.Add(new CircleMembership
        {
            CircleId = _subscribableCircleId,
            UserId = _friend1Id
        });
        
        await context.SaveChangesAsync();
    }
    
    private async Task CleanupTestDataAsync(CliqDbContext context)
    {
        var userIds = new[] { _mainUserId, _friend1Id, _friend2Id, _friend3Id, _fof1Id, _fof2Id };
        
        // Remove circle memberships
        var memberships = await context.CircleMemberships
            .Where(cm => userIds.Contains(cm.UserId))
            .ToListAsync();
        context.CircleMemberships.RemoveRange(memberships);
        
        // Remove circles
        var circles = await context.Circles
            .Where(c => userIds.Contains(c.OwnerId))
            .ToListAsync();
        context.Circles.RemoveRange(circles);
        
        // Remove friendships
        var friendships = await context.Friendships
            .Where(f => userIds.Contains(f.RequesterId) || userIds.Contains(f.AddresseeId))
            .ToListAsync();
        context.Friendships.RemoveRange(friendships);
        
        // Remove users
        var users = await context.Users
            .Where(u => userIds.Contains(u.Id))
            .ToListAsync();
        context.Users.RemoveRange(users);
        
        await context.SaveChangesAsync();
    }

    private IPostService CreatePostService(CliqDbContext context)
    {
        var friendshipService = new FriendshipService(context, _mapper, _mockStorageService.Object, _mockEventNotificationService.Object);
        var circleService = new CircleService(context, _mockCommentService.Object, friendshipService, _mapper, _mockEventNotificationService.Object, _mockCircleLogger.Object, _mockStorageService.Object);
        
        var mockNotificationService = new Mock<INotificationService>();
        mockNotificationService.Setup(x => x.GetNotifications(It.IsAny<Guid>()))
            .ReturnsAsync(new NotificationFeedDto
            {
                friendRequests = new List<FriendRequestDto>(),
                notifications = new List<NotificationDto>()
            });
        
        var metricsService = new MetricsService();
        var mockActivityService = new Mock<IUserActivityService>();
        
        return new PostService(
            context,
            _mockCommentService.Object,
            friendshipService,
            circleService,
            _mapper,
            _mockPostLogger.Object,
            _mockEventNotificationService.Object,
            mockNotificationService.Object,
            _mockStorageService.Object,
            metricsService,
            mockActivityService.Object);
    }

    #region Page 1 Returns Recommendations

    [Fact]
    public async Task GetFeedForUserAsync_Page1_ReturnsRecommendedFriends()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        var postService = CreatePostService(context);
        
        // Act
        var feed = await postService.GetFeedForUserAsync(_mainUserId, page: 1);
        
        // Assert
        Assert.NotNull(feed.RecommendedFriends);
        Assert.NotEmpty(feed.RecommendedFriends);
        
        _output.WriteLine($"Page 1 returned {feed.RecommendedFriends.Count} recommended friends:");
        foreach (var rec in feed.RecommendedFriends)
        {
            _output.WriteLine($"  - {rec.User.Name}: {rec.MutualFriendCount} mutual friends");
        }
        
        // Should include FoF2 (3 mutual) and FoF1 (2 mutual)
        Assert.Contains(feed.RecommendedFriends, r => r.User.Id == _fof2Id);
        Assert.Contains(feed.RecommendedFriends, r => r.User.Id == _fof1Id);
    }

    [Fact]
    public async Task GetFeedForUserAsync_Page1_ReturnsAvailableSubscribableCircles()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        var postService = CreatePostService(context);
        
        // Act
        var feed = await postService.GetFeedForUserAsync(_mainUserId, page: 1);
        
        // Assert
        Assert.NotNull(feed.AvailableSubscribableCircles);
        Assert.NotEmpty(feed.AvailableSubscribableCircles);
        
        _output.WriteLine($"Page 1 returned {feed.AvailableSubscribableCircles.Count} subscribable circles:");
        foreach (var circle in feed.AvailableSubscribableCircles)
        {
            _output.WriteLine($"  - {circle.Name} (owned by {circle.Owner?.Name})");
        }
        
        // Should include friend1's subscribable circle
        Assert.Contains(feed.AvailableSubscribableCircles, c => c.Id == _subscribableCircleId);
    }

    [Fact]
    public async Task GetFilteredFeedForUserAsync_Page1_ReturnsRecommendedFriends()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        var postService = CreatePostService(context);
        
        // Act - pass null for circleIds to get all posts
        var feed = await postService.GetFilteredFeedForUserAsync(_mainUserId, circleIds: null, page: 1);
        
        // Assert
        Assert.NotNull(feed.RecommendedFriends);
        Assert.NotEmpty(feed.RecommendedFriends);
        
        _output.WriteLine($"Filtered feed page 1 returned {feed.RecommendedFriends.Count} recommended friends");
    }

    #endregion

    #region Page 2+ Does NOT Return Recommendations

    [Fact]
    public async Task GetFeedForUserAsync_Page2_ReturnsEmptyRecommendedFriends()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        var postService = CreatePostService(context);
        
        // Act
        var feed = await postService.GetFeedForUserAsync(_mainUserId, page: 2);
        
        // Assert
        Assert.NotNull(feed.RecommendedFriends);
        Assert.Empty(feed.RecommendedFriends);
        
        _output.WriteLine("✓ Page 2 returns empty recommended friends list");
    }

    [Fact]
    public async Task GetFeedForUserAsync_Page2_ReturnsEmptySubscribableCircles()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        var postService = CreatePostService(context);
        
        // Act
        var feed = await postService.GetFeedForUserAsync(_mainUserId, page: 2);
        
        // Assert
        Assert.NotNull(feed.AvailableSubscribableCircles);
        Assert.Empty(feed.AvailableSubscribableCircles);
        
        _output.WriteLine("✓ Page 2 returns empty subscribable circles list");
    }

    [Fact]
    public async Task GetFilteredFeedForUserAsync_Page2_ReturnsEmptyRecommendedFriends()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        var postService = CreatePostService(context);
        
        // Act
        var feed = await postService.GetFilteredFeedForUserAsync(_mainUserId, circleIds: null, page: 2);
        
        // Assert
        Assert.NotNull(feed.RecommendedFriends);
        Assert.Empty(feed.RecommendedFriends);
        
        _output.WriteLine("✓ Filtered feed page 2 returns empty recommended friends list");
    }

    [Fact]
    public async Task GetFeedForUserAsync_Page3_ReturnsEmptyRecommendations()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        var postService = CreatePostService(context);
        
        // Act
        var feed = await postService.GetFeedForUserAsync(_mainUserId, page: 3);
        
        // Assert
        Assert.NotNull(feed.RecommendedFriends);
        Assert.Empty(feed.RecommendedFriends);
        Assert.NotNull(feed.AvailableSubscribableCircles);
        Assert.Empty(feed.AvailableSubscribableCircles);
        
        _output.WriteLine("✓ Page 3 returns no recommendations");
    }

    #endregion

    #region Recommendation Quality Tests

    [Fact]
    public async Task GetFeedForUserAsync_RecommendedFriends_SortedByMutualCount()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        var postService = CreatePostService(context);
        
        // Act
        var feed = await postService.GetFeedForUserAsync(_mainUserId, page: 1);
        
        // Assert - FoF2 (3 mutual) should come before FoF1 (2 mutual)
        var fof2Index = feed.RecommendedFriends.FindIndex(r => r.User.Id == _fof2Id);
        var fof1Index = feed.RecommendedFriends.FindIndex(r => r.User.Id == _fof1Id);
        
        Assert.True(fof2Index < fof1Index, $"FoF2 (3 mutual) should come before FoF1 (2 mutual). FoF2 index: {fof2Index}, FoF1 index: {fof1Index}");
        
        _output.WriteLine("✓ Recommended friends are sorted by mutual friend count (descending)");
    }

    [Fact]
    public async Task GetFeedForUserAsync_RecommendedFriends_ExcludesExistingFriends()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        var postService = CreatePostService(context);
        
        // Act
        var feed = await postService.GetFeedForUserAsync(_mainUserId, page: 1);
        
        // Assert - should not include direct friends
        Assert.DoesNotContain(feed.RecommendedFriends, r => r.User.Id == _friend1Id);
        Assert.DoesNotContain(feed.RecommendedFriends, r => r.User.Id == _friend2Id);
        Assert.DoesNotContain(feed.RecommendedFriends, r => r.User.Id == _friend3Id);
        
        _output.WriteLine("✓ Recommended friends do not include existing friends");
    }

    [Fact]
    public async Task GetFeedForUserAsync_SubscribableCircles_ExcludesOwnedCircles()
    {
        // Arrange - add main user as owner of a subscribable circle
        using var context = _fixture.CreateContext();
        
        var mainUserCircle = new Circle
        {
            Id = Guid.NewGuid(),
            Name = "Main User's Circle",
            OwnerId = _mainUserId,
            IsSubscribable = true
        };
        context.Circles.Add(mainUserCircle);
        await context.SaveChangesAsync();
        
        var postService = CreatePostService(context);
        
        // Act
        var feed = await postService.GetFeedForUserAsync(_mainUserId, page: 1);
        
        // Assert - should not include main user's own circle
        Assert.DoesNotContain(feed.AvailableSubscribableCircles, c => c.Id == mainUserCircle.Id);
        
        // Cleanup
        context.Circles.Remove(mainUserCircle);
        await context.SaveChangesAsync();
        
        _output.WriteLine("✓ Subscribable circles do not include user's own circles");
    }

    #endregion
}
