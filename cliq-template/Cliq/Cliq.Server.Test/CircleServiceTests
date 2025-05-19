using Cliq.Server.Data;
using Cliq.Server.Models;
using Cliq.Server.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using AutoMapper;

public class CircleServiceTests : DatabaseTestBase
{
    private readonly ICircleService _circleService;
    private readonly IMapper _mapper;
    private readonly Mock<ILogger<CircleService>> _mockLogger;
    private readonly Mock<ICommentService> _mockCommentService;

    // Test user IDs that will be consistent across tests
    private readonly Guid _userId1 = Guid.NewGuid();
    private readonly Guid _userId2 = Guid.NewGuid();
    private readonly Guid _userId3 = Guid.NewGuid();
    private readonly Guid _circleId1;
    private readonly Guid _circleId2;
    private readonly Guid _circleId3;

    public CircleServiceTests()
    {
        // Create GUIDs for circles
        _circleId1 = Guid.NewGuid();
        _circleId2 = Guid.NewGuid();
        _circleId3 = Guid.NewGuid();

        // Setup AutoMapper
        var mapperConfig = new MapperConfiguration(cfg =>
        {
            cfg.CreateMap<Circle, CirclePublicDto>();
        });
        _mapper = mapperConfig.CreateMapper();

        // Setup mocks
        _mockLogger = new Mock<ILogger<CircleService>>();
        _mockCommentService = new Mock<ICommentService>();

        // Create the service with our test context
        _circleService = new CircleService(
            Context, 
            _mockCommentService.Object,
            _mapper,
            _mockLogger.Object);
    }

    protected override async Task SetupTestDataAsync(CliqDbContext context)
    {
        // Create test users
        var users = new List<User>
        {
            new User("user1@example.com") { Id = _userId1, Name = "User One" },
            new User("user2@example.com") { Id = _userId2, Name = "User Two" },
            new User("user3@example.com") { Id = _userId3, Name = "User Three" }
        };
        context.Users.AddRange(users);

        // Create test circles
        var circles = new List<Circle>
        {
            // Circle owned by user 1, shared
            new Circle 
            { 
                Id = _circleId1, 
                Name = "Shared Circle", 
                IsShared = true, 
                OwnerId = _userId1,
                Members = new List<CircleMembership>()
            },
            
            // Circle owned by user 1, not shared
            new Circle 
            { 
                Id = _circleId2, 
                Name = "Private Circle", 
                IsShared = false, 
                OwnerId = _userId1,
                Members = new List<CircleMembership>()
            },
            
            // Circle owned by user 2, shared
            new Circle 
            { 
                Id = _circleId3, 
                Name = "User 2's Circle", 
                IsShared = true, 
                OwnerId = _userId2,
                Members = new List<CircleMembership>()
            }
        };
        context.Circles.AddRange(circles);

        // Create memberships
        var memberships = new List<CircleMembership>
        {
            // User 2 is a member of user 1's shared circle
            new CircleMembership 
            { 
                CircleId = _circleId1, 
                UserId = _userId2, 
                IsModerator = false 
            },
            
            // User 3 is a member of user 1's shared circle
            new CircleMembership 
            { 
                CircleId = _circleId1, 
                UserId = _userId3, 
                IsModerator = true 
            },
            
            // User 3 is a member of user 1's private circle
            new CircleMembership 
            { 
                CircleId = _circleId2, 
                UserId = _userId3, 
                IsModerator = false 
            },
            
            // User 1 is a member of user 2's circle
            new CircleMembership 
            { 
                CircleId = _circleId3, 
                UserId = _userId1, 
                IsModerator = false 
            }
        };
        context.CircleMemberships.AddRange(memberships);

        await context.SaveChangesAsync();
    }

    [Fact]
    public async Task CreateCircleAsync_CreatesNewCircle()
    {
        // Arrange
        var circleDto = new CircleCreationDto
        {
            Name = "New Test Circle",
            IsShared = true
        };

        // Act
        var result = await _circleService.CreateCircleAsync(_userId1, circleDto);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("New Test Circle", result.Name);
        Assert.True(result.IsShared);

        // Verify it was added to the database
        var savedCircle = await Context.Circles.FirstOrDefaultAsync(c => c.Name == "New Test Circle");
        Assert.NotNull(savedCircle);
        Assert.Equal(_userId1, savedCircle.OwnerId);
    }

    [Fact]
    public async Task CreateCircleAsync_ThrowsException_ForInvalidUser()
    {
        // Arrange
        var invalidUserId = Guid.NewGuid();
        var circleDto = new CircleCreationDto
        {
            Name = "Invalid User Circle",
            IsShared = true
        };

        // Act & Assert
        await Assert.ThrowsAsync<BadHttpRequestException>(() => 
            _circleService.CreateCircleAsync(invalidUserId, circleDto));
    }

    [Fact]
    public async Task GetCircleAsync_ReturnsCircle_WhenUserIsOwner()
    {
        // Act
        var result = await _circleService.GetCircleAsync(_userId1, _circleId1);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(_circleId1, result.Id);
        Assert.Equal("Shared Circle", result.Name);
    }

    [Fact]
    public async Task GetCircleAsync_ReturnsCircle_WhenUserIsMemberOfSharedCircle()
    {
        // Act
        var result = await _circleService.GetCircleAsync(_userId2, _circleId1);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(_circleId1, result.Id);
        Assert.Equal("Shared Circle", result.Name);
    }

    [Fact]
    public async Task GetCircleAsync_ThrowsException_WhenUserIsNotAuthorized()
    {
        // Arrange - user 2 is not a member of user 1's private circle
        
        // Act & Assert
        await Assert.ThrowsAsync<BadHttpRequestException>(() => 
            _circleService.GetCircleAsync(_userId2, _circleId2));
    }

    [Fact]
    public async Task GetUserOwnedCirclesAsync_ReturnsAllCirclesOwnedByUser()
    {
        // Act
        var result = await _circleService.GetUserOwnedCirclesAsync(_userId1);
        var circles = result.ToList();

        // Assert
        Assert.Equal(2, circles.Count);
        Assert.Contains(circles, c => c.Id == _circleId1);
        Assert.Contains(circles, c => c.Id == _circleId2);
    }

    [Fact]
    public async Task GetUserOwnedCirclesAsync_ReturnsEmptyList_ForUserWithNoCircles()
    {
        // Act
        var result = await _circleService.GetUserOwnedCirclesAsync(_userId3);

        // Assert
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetUserOwnedCirclesAsync_ThrowsException_ForInvalidUser()
    {
        // Arrange
        var invalidUserId = Guid.NewGuid();

        // Act & Assert
        await Assert.ThrowsAsync<BadHttpRequestException>(() => 
            _circleService.GetUserOwnedCirclesAsync(invalidUserId));
    }

    [Fact]
    public async Task GetUserMemberCirclesAsync_ReturnsCirclesWhereUserIsMember()
    {
        // Act - User 3 is a member of two circles but owns none
        var result = await _circleService.GetUserMemberCirclesAsync(_userId3);
        var circles = result.ToList();

        // Assert - Should only return the shared circle (not the private circle)
        Assert.Single(circles);
        Assert.Contains(circles, c => c.Id == _circleId1);
        Assert.DoesNotContain(circles, c => c.Id == _circleId2);
    }

    [Fact]
    public async Task GetUserMemberCirclesAsync_IncludesOwnedCirclesWithIsOwnerFlag()
    {
        // Act - User 1 owns two circles and is a member of one
        var result = await _circleService.GetUserMemberCirclesAsync(_userId1);
        var circles = result.ToList();

        // Assert - Should return all three circles, with owned ones marked
        Assert.Equal(3, circles.Count);
        
        // Check the owned circles have IsOwner = true
        var ownedCircles = circles.Where(c => c.IsOwner).ToList();
        Assert.Equal(2, ownedCircles.Count);
        Assert.Contains(ownedCircles, c => c.Id == _circleId1);
        Assert.Contains(ownedCircles, c => c.Id == _circleId2);
        
        // Check member circle
        var memberCircle = circles.FirstOrDefault(c => c.Id == _circleId3);
        Assert.NotNull(memberCircle);
        Assert.False(memberCircle.IsOwner);
    }

    [Fact]
    public async Task GetUserMemberCirclesAsync_ThrowsException_ForInvalidUser()
    {
        // Arrange
        var invalidUserId = Guid.NewGuid();

        // Act & Assert
        await Assert.ThrowsAsync<BadHttpRequestException>(() => 
            _circleService.GetUserMemberCirclesAsync(invalidUserId));
    }

    [Fact]
    public async Task ValidateAuthorizationToPostAsync_AllowsAuthorizedUser()
    {
        // Arrange - user 1 has access to all three circles
        var circleIds = new[] { _circleId1, _circleId2, _circleId3 };

        // Act & Assert - No exception means it passed
        await CircleService.ValidateAuthorizationToPostAsync(Context, circleIds, _userId1);
    }

    [Fact]
    public async Task ValidateAuthorizationToPostAsync_ThrowsException_ForUnauthorizedCircles()
    {
        // Arrange - user 2 only has access to circles 1 and 3, not 2
        var circleIds = new[] { _circleId1, _circleId2, _circleId3 };

        // Act & Assert
        var exception = await Assert.ThrowsAsync<UnauthorizedAccessException>(() => 
            CircleService.ValidateAuthorizationToPostAsync(Context, circleIds, _userId2));
            
        // Verify the error message contains the circle ID
        Assert.Contains(_circleId2.ToString(), exception.Message);
    }

    [Fact]
    public async Task ValidateAuthorizationToPostAsync_ThrowsException_ForInvalidCircles()
    {
        // Arrange
        var invalidCircleId = Guid.NewGuid();
        var circleIds = new[] { _circleId1, invalidCircleId };

        // Act & Assert
        var exception = await Assert.ThrowsAsync<BadHttpRequestException>(() => 
            CircleService.ValidateAuthorizationToPostAsync(Context, circleIds, _userId1));
            
        // Verify the error message contains the circle ID
        Assert.Contains(invalidCircleId.ToString(), exception.Message);
    }
}