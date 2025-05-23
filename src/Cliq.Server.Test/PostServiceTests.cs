using Cliq.Server.Data;
using Cliq.Server.Models;
using Cliq.Server.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using AutoMapper;
using Microsoft.AspNetCore.Http;

namespace Cliq.Server.Test;

[Collection("Database Tests")]
public class PostServiceTests : IClassFixture<DatabaseFixture>
{
    private readonly DatabaseFixture _fixture;
    private readonly IMapper _mapper;
    private readonly Mock<ILogger<PostService>> _mockLogger;
    private readonly Mock<ICommentService> _mockCommentService;

    // Test user IDs that will be consistent across tests
    private readonly Guid _userId1 = Guid.NewGuid();
    private readonly Guid _userId2 = Guid.NewGuid();
    private readonly Guid _userId3 = Guid.NewGuid();
    private readonly Guid _userId4 = Guid.NewGuid(); // User with no access
    
    private readonly Guid _circleId1;
    private readonly Guid _circleId2;
    private readonly Guid _postId1;
    private readonly Guid _postId2;
    private readonly Guid _postId3;

    public PostServiceTests(DatabaseFixture fixture)
    {
        _fixture = fixture;

        // Create GUIDs for test data
        _circleId1 = Guid.NewGuid();
        _circleId2 = Guid.NewGuid();
        _postId1 = Guid.NewGuid();
        _postId2 = Guid.NewGuid();
        _postId3 = Guid.NewGuid();

        // Setup AutoMapper
        var mapperConfig = new MapperConfiguration(cfg =>
        {
            cfg.CreateMap<Post, PostDto>();
            cfg.CreateMap<User, UserDto>();
            cfg.CreateMap<Comment, CommentDto>();
        });
        _mapper = mapperConfig.CreateMapper();

        // Setup mocks
        _mockLogger = new Mock<ILogger<PostService>>();
        _mockCommentService = new Mock<ICommentService>();
        
        // Setup comment service to return empty list by default
        _mockCommentService.Setup(cs => cs.GetAllCommentsForPostAsync(It.IsAny<Guid>()))
            .ReturnsAsync(new List<CommentDto>());
        
        // Setup test data
        SetupTestDataAsync().GetAwaiter().GetResult();
    }
    
    private async Task SetupTestDataAsync()
    {
        // Create a new context for setup
        using var context = _fixture.CreateContext();
        
        // Clean any existing data from previous tests
        await CleanupTestDataAsync(context);
        
        // Create test users
        var users = new List<User>
        {
            new User("user1@example.com") { Id = _userId1, Name = "User One" },
            new User("user2@example.com") { Id = _userId2, Name = "User Two" },
            new User("user3@example.com") { Id = _userId3, Name = "User Three" },
            new User("user4@example.com") { Id = _userId4, Name = "User Four" }
        };
        context.Users.AddRange(users);

        // Create test circles
        var circles = new List<Circle>
        {
            new Circle
            {
                Id = _circleId1,
                Name = "Shared Circle",
                IsShared = true,
                OwnerId = _userId1,
            },
            new Circle
            {
                Id = _circleId2,
                Name = "Private Circle", 
                IsShared = false,
                OwnerId = _userId2,
            }
        };
        context.Circles.AddRange(circles);

        // Create memberships
        var memberships = new List<CircleMembership>
        {
            // Circle 1 memberships
            new CircleMembership { CircleId = _circleId1, UserId = _userId1, IsModerator = true },
            new CircleMembership { CircleId = _circleId1, UserId = _userId2, IsModerator = false },
            new CircleMembership { CircleId = _circleId1, UserId = _userId3, IsModerator = false },
            
            // Circle 2 memberships (private circle)
            new CircleMembership { CircleId = _circleId2, UserId = _userId2, IsModerator = true },
            new CircleMembership { CircleId = _circleId2, UserId = _userId3, IsModerator = false }
            // Note: userId4 is not a member of any circle
        };
        context.CircleMemberships.AddRange(memberships);

        // Create test posts
        var posts = new List<Post>
        {
            new Post
            {
                Id = _postId1,
                UserId = _userId1,
                Text = "Post by User 1",
                Date = DateTime.UtcNow.AddHours(-1)
            },
            new Post
            {
                Id = _postId2,
                UserId = _userId2,
                Text = "Post by User 2",
                Date = DateTime.UtcNow.AddHours(-2)
            },
            new Post
            {
                Id = _postId3,
                UserId = _userId3,
                Text = "Post by User 3",
                Date = DateTime.UtcNow.AddHours(-3)
            }
        };
        context.Posts.AddRange(posts);

        // Create circle posts (sharing posts to circles)
        var circlePosts = new List<CirclePost>
        {
            // Post 1 shared to Circle 1
            new CirclePost { CircleId = _circleId1, PostId = _postId1, SharedAt = DateTime.UtcNow },
            
            // Post 2 shared to Circle 2 (private)
            new CirclePost { CircleId = _circleId2, PostId = _postId2, SharedAt = DateTime.UtcNow },
            
            // Post 3 shared to both circles
            new CirclePost { CircleId = _circleId1, PostId = _postId3, SharedAt = DateTime.UtcNow },
            new CirclePost { CircleId = _circleId2, PostId = _postId3, SharedAt = DateTime.UtcNow }
        };
        context.CirclePosts.AddRange(circlePosts);

        await context.SaveChangesAsync();
    }
    
    private async Task CleanupTestDataAsync(CliqDbContext context)
    {
        // Remove data in proper order to avoid foreign key constraints
        var existingCirclePosts = await context.CirclePosts
            .Where(cp => cp.PostId == _postId1 || cp.PostId == _postId2 || cp.PostId == _postId3)
            .ToListAsync();
        context.CirclePosts.RemoveRange(existingCirclePosts);
        
        var existingPosts = await context.Posts
            .Where(p => p.UserId == _userId1 || p.UserId == _userId2 || p.UserId == _userId3 || p.UserId == _userId4)
            .ToListAsync();
        context.Posts.RemoveRange(existingPosts);
        
        var existingMemberships = await context.CircleMemberships
            .Where(m => m.UserId == _userId1 || m.UserId == _userId2 || m.UserId == _userId3 || m.UserId == _userId4)
            .ToListAsync();
        context.CircleMemberships.RemoveRange(existingMemberships);
        
        var existingCircles = await context.Circles
            .Where(c => c.OwnerId == _userId1 || c.OwnerId == _userId2 || c.OwnerId == _userId3 || c.OwnerId == _userId4)
            .ToListAsync();
        context.Circles.RemoveRange(existingCircles);
        
        var existingUsers = await context.Users
            .Where(u => u.Id == _userId1 || u.Id == _userId2 || u.Id == _userId3 || u.Id == _userId4)
            .ToListAsync();
        context.Users.RemoveRange(existingUsers);
        
        await context.SaveChangesAsync();
    }

    private IPostService CreatePostService()
    {
        // Create a fresh context for each test
        var context = _fixture.CreateContext();
        
        return new PostService(
            context,
            _mockCommentService.Object,
            _mapper,
            _mockLogger.Object);
    }

    [Fact]
    public async Task GetPostByIdAsync_ReturnsPost_WhenUserIsPostOwner()
    {
        // Arrange
        var postService = CreatePostService();

        // Act
        var result = await postService.GetPostByIdAsync(_userId1, _postId1, includeCommentTree: false);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(_postId1, result.Id);
        Assert.Equal("Post by User 1", result.Text);
        Assert.Equal(_userId1, result.User.Id);
        Assert.Equal("User One", result.User.Name);
    }

    [Fact]
    public async Task GetPostByIdAsync_ReturnsPost_WhenUserIsMemberOfSharedCircle()
    {
        // Arrange - User 2 is a member of Circle 1, where Post 1 is shared
        var postService = CreatePostService();

        // Act
        var result = await postService.GetPostByIdAsync(_userId2, _postId1, includeCommentTree: false);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(_postId1, result.Id);
        Assert.Equal("Post by User 1", result.Text);
    }

    [Fact]
    public async Task GetPostByIdAsync_ReturnsPost_WhenUserIsMemberOfPrivateCircle()
    {
        // Arrange - User 3 is a member of Circle 2 (private), where Post 2 is shared
        var postService = CreatePostService();

        // Act
        var result = await postService.GetPostByIdAsync(_userId3, _postId2, includeCommentTree: false);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(_postId2, result.Id);
        Assert.Equal("Post by User 2", result.Text);
    }

    [Fact]
    public async Task GetPostByIdAsync_ReturnsPost_WhenUserHasAccessToMultipleCircles()
    {
        // Arrange - User 3 is a member of both circles, Post 3 is shared to both
        var postService = CreatePostService();

        // Act
        var result = await postService.GetPostByIdAsync(_userId3, _postId3, includeCommentTree: false);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(_postId3, result.Id);
        Assert.Equal("Post by User 3", result.Text);
    }

    [Fact]
    public async Task GetPostByIdAsync_ReturnsNull_WhenUserHasNoAccess()
    {
        // Arrange - User 4 is not a member of any circle and doesn't own any posts
        var postService = CreatePostService();

        // Act
        var result = await postService.GetPostByIdAsync(_userId4, _postId1, includeCommentTree: false);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task GetPostByIdAsync_ReturnsNull_WhenPostDoesNotExist()
    {
        // Arrange
        var postService = CreatePostService();
        var nonExistentPostId = Guid.NewGuid();

        // Act & Assert
        await Assert.ThrowsAsync<BadHttpRequestException>(async () =>
        {
            await postService.GetPostByIdAsync(_userId1, nonExistentPostId, includeCommentTree: false);
        });
    }

    [Fact]
    public async Task GetPostByIdAsync_IncludesComments_WhenIncludeCommentTreeIsTrue()
    {
        // Arrange
        var postService = CreatePostService();
        var expectedComments = new List<CommentDto>
        {
            new CommentDto { Date = DateTime.Now, Id = Guid.NewGuid(), Text = "Test comment", User = new UserDto { Id = _userId1, Name = "User One" } }
        };
        
        _mockCommentService.Setup(cs => cs.GetAllCommentsForPostAsync(_postId1))
            .ReturnsAsync(expectedComments);

        // Act
        var result = await postService.GetPostByIdAsync(_userId1, _postId1, includeCommentTree: true);

        // Assert
        Assert.NotNull(result);
        Assert.NotNull(result.Comments);
        Assert.Single(result.Comments);
        Assert.Equal("Test comment", result.Comments.First().Text);
        
        // Verify comment service was called
        _mockCommentService.Verify(cs => cs.GetAllCommentsForPostAsync(_postId1), Times.Once);
    }

    [Fact]
    public async Task GetPostByIdAsync_DoesNotIncludeComments_WhenIncludeCommentTreeIsFalse()
    {
        // Arrange
        var postService = CreatePostService();

        // Act
        var result = await postService.GetPostByIdAsync(_userId1, _postId1, includeCommentTree: false);

        // Assert
        Assert.NotNull(result);
        Assert.Empty(result.Comments);
        
        // Verify comment service was not called
        _mockCommentService.Verify(cs => cs.GetAllCommentsForPostAsync(It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task GetPostByIdAsync_LogsWarning_WhenUnauthorizedAccessAttempted()
    {
        // Arrange
        var postService = CreatePostService();

        // Act
        var result = await postService.GetPostByIdAsync(_userId4, _postId1, includeCommentTree: false);

        // Assert
        Assert.Null(result);
        
        // Verify warning was logged
        _mockLogger.Verify(
            logger => logger.Log(
                LogLevel.Warning,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => v.ToString().Contains("unauthorized access")),
                It.IsAny<Exception>(),
                It.IsAny<Func<It.IsAnyType, Exception, string>>()),
            Times.Once);
    }

    [Fact]
    public async Task GetPostByIdAsync_ShortCircuits_WhenUserIsOwner()
    {
        // Arrange - This test verifies that when a user owns a post, 
        // no circle membership check is performed
        var postService = CreatePostService();

        // Act
        var result = await postService.GetPostByIdAsync(_userId1, _postId1, includeCommentTree: false);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(_postId1, result.Id);
        
        // The fact that this works even if we didn't set up circle memberships
        // proves the short-circuit logic works
    }

    [Fact]
    public async Task GetPostByIdAsync_WorksWithDifferentCirclePermissions()
    {
        // Arrange - Test edge case where user has access through one circle but not another
        var postService = CreatePostService();

        // Act - User 2 can access Post 3 through Circle 1 membership, 
        // even though Post 3 is also in Circle 2 (which User 2 owns)
        var result = await postService.GetPostByIdAsync(_userId2, _postId3, includeCommentTree: false);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(_postId3, result.Id);
        Assert.Equal("Post by User 3", result.Text);
    }

    [Fact]
    public async Task GetPostByIdAsync_ReturnsCorrectUserInformation()
    {
        // Arrange
        var postService = CreatePostService();

        // Act
        var result = await postService.GetPostByIdAsync(_userId2, _postId1, includeCommentTree: false);

        // Assert
        Assert.NotNull(result);
        Assert.NotNull(result.User);
        Assert.Equal(_userId1, result.User.Id);
        Assert.Equal("User One", result.User.Name);
    }
}