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
public class CircleServiceTests : IClassFixture<DatabaseFixture>
{
    private readonly DatabaseFixture _fixture;
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

    public CircleServiceTests(DatabaseFixture fixture)
    {
        _fixture = fixture;

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
            new User("user3@example.com") { Id = _userId3, Name = "User Three" }
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
                OwnerId = _userId1,
            },
            new Circle
            {
                Id = _circleId3,
                Name = "User 2's Circle",
                IsShared = true,
                OwnerId = _userId2,
            }
        };
        context.Circles.AddRange(circles);

        // Create memberships
        var memberships = new List<CircleMembership>
        {
            new CircleMembership
            {
                CircleId = _circleId1,
                UserId = _userId1,  // Owner should be a member of their circle
                IsModerator = true
            },
            new CircleMembership
            {
                CircleId = _circleId1,
                UserId = _userId2,
                IsModerator = false
            },
            new CircleMembership
            {
                CircleId = _circleId1,
                UserId = _userId3,
                IsModerator = true
            },
            new CircleMembership
            {
                CircleId = _circleId2,
                UserId = _userId1,  // Owner should be a member of their circle
                IsModerator = true
            },
            new CircleMembership
            {
                CircleId = _circleId2,
                UserId = _userId3,
                IsModerator = false
            },
            new CircleMembership
            {
                CircleId = _circleId3,
                UserId = _userId2,  // Owner should be a member of their circle
                IsModerator = true
            },
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
    
    private async Task CleanupTestDataAsync(CliqDbContext context)
    {
        // Remove any data from previous test runs
        var existingMemberships = await context.CircleMemberships
            .Where(m => m.UserId == _userId1 || m.UserId == _userId2 || m.UserId == _userId3)
            .ToListAsync();
        context.CircleMemberships.RemoveRange(existingMemberships);
        
        var existingCircles = await context.Circles
            .Where(c => c.OwnerId == _userId1 || c.OwnerId == _userId2 || c.OwnerId == _userId3)
            .ToListAsync();
        context.Circles.RemoveRange(existingCircles);
        
        var existingUsers = await context.Users
            .Where(u => u.Id == _userId1 || u.Id == _userId2 || u.Id == _userId3)
            .ToListAsync();
        context.Users.RemoveRange(existingUsers);
        
        var existingFriendships = await context.Friendships
            .Where(f => f.RequesterId == _userId1 || f.RequesterId == _userId2 || 
                   f.RequesterId == _userId3 || f.AddresseeId == _userId1 || 
                   f.AddresseeId == _userId2 || f.AddresseeId == _userId3)
            .ToListAsync();
        context.Friendships.RemoveRange(existingFriendships);
        
        await context.SaveChangesAsync();
    }

    private ICircleService CreateCircleService()
    {
        // Create a fresh context for each test
        var context = _fixture.CreateContext();
        var mockFriendshipService = new Mock<IFriendshipService>();
        var mockEventNotificationService = new Mock<IEventNotificationService>();
        
        var mockStorageService = new Mock<IObjectStorageService>();
        return new CircleService(
            context,
            _mockCommentService.Object,
            mockFriendshipService.Object,
            _mapper,
            mockEventNotificationService.Object,
            _mockLogger.Object,
            mockStorageService.Object);
    }

    [Fact]
    public async Task CreateCircleAsync_CreatesNewCircle()
    {
        // Arrange
        var circleService = CreateCircleService();
        var circleDto = new CircleCreationDto
        {
            Name = "New Test Circle",
            IsShared = true
        };

        // Act
        var result = await circleService.CreateCircleAsync(_userId1, circleDto);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("New Test Circle", result.Name);
        Assert.True(result.IsShared);

        // Verify it was added to the database
        using (var context = _fixture.CreateContext())
        {
            var savedCircle = await context.Circles.FirstOrDefaultAsync(c => c.Name == "New Test Circle");
            Assert.NotNull(savedCircle);
            Assert.Equal(_userId1, savedCircle.OwnerId);
        }
    }

    [Fact]
    public async Task CreateCircleAsync_ThrowsException_ForInvalidUser()
    {
        // Arrange
        var circleService = CreateCircleService();
        var invalidUserId = Guid.NewGuid();
        var circleDto = new CircleCreationDto
        {
            Name = "Invalid User Circle",
            IsShared = true
        };

        // Act & Assert
        await Assert.ThrowsAsync<BadHttpRequestException>(() =>
            circleService.CreateCircleAsync(invalidUserId, circleDto));
    }

    [Fact]
    public async Task GetCircleAsync_ReturnsCircle_WhenUserIsOwner()
    {
        // Arrange
        var circleService = CreateCircleService();

        // Act
        var result = await circleService.GetCircleAsync(_userId1, _circleId1);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(_circleId1, result.Id);
        Assert.Equal("Shared Circle", result.Name);
    }

    [Fact]
    public async Task GetCircleAsync_ReturnsCircle_WhenUserIsMemberOfSharedCircle()
    {
        // Arrange
        var circleService = CreateCircleService();
        // Act
        var result = await circleService.GetCircleAsync(_userId2, _circleId1);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(_circleId1, result.Id);
        Assert.Equal("Shared Circle", result.Name);
    }

    [Fact]
    public async Task GetCircleAsync_ThrowsException_WhenUserIsNotAuthorized()
    {
        // Arrange - user 2 is not a member of user 1's private circle
        var circleService = CreateCircleService();
        // Act & Assert
        await Assert.ThrowsAsync<BadHttpRequestException>(() =>
            circleService.GetCircleAsync(_userId2, _circleId2));
    }

    [Fact]
    public async Task GetUserOwnedCirclesAsync_ReturnsAllCirclesOwnedByUser()
    {
        // Arrange
        var circleService = CreateCircleService();

        // Act
        var result = await circleService.GetUserOwnedCirclesAsync(_userId1);
        var circles = result.ToList();

        // Assert
        Assert.Equal(2, circles.Count);
        Assert.Contains(circles, c => c.Id == _circleId1);
        Assert.Contains(circles, c => c.Id == _circleId2);
    }

    [Fact]
    public async Task GetUserOwnedCirclesAsync_ReturnsEmptyList_ForUserWithNoCircles()
    {
        // Arrange
        var circleService = CreateCircleService();
        // Act
        var result = await circleService.GetUserOwnedCirclesAsync(_userId3);

        // Assert
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetUserOwnedCirclesAsync_ThrowsException_ForInvalidUser()
    {
        // Arrange
        var circleService = CreateCircleService();
        var invalidUserId = Guid.NewGuid();

        // Act & Assert
        await Assert.ThrowsAsync<BadHttpRequestException>(() =>
            circleService.GetUserOwnedCirclesAsync(invalidUserId));
    }

    [Fact]
    public async Task GetUserMemberCirclesAsync_ReturnsCirclesWhereUserIsMember()
    {
        // Arrange
        var circleService = CreateCircleService();
        // Act - User 3 is a member of two circles but owns none
        var result = await circleService.GetUserMemberCirclesAsync(_userId3);
        var circles = result.ToList();

        // Assert - Should only return the shared circle (not the private circle)
        Assert.Single(circles);
        Assert.Contains(circles, c => c.Id == _circleId1);
        Assert.DoesNotContain(circles, c => c.Id == _circleId2);
    }

    [Fact]
    public async Task GetUserMemberCirclesAsync_IncludesOwnedCirclesWithIsOwnerFlag()
    {
        // Arrange
        var circleService = CreateCircleService();

        // Act - User 1 owns two circles and is a member of one
        var result = await circleService.GetUserMemberCirclesAsync(_userId1);
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
        var circleService = CreateCircleService();
        var invalidUserId = Guid.NewGuid();

        // Act & Assert
        await Assert.ThrowsAsync<BadHttpRequestException>(() =>
            circleService.GetUserMemberCirclesAsync(invalidUserId));
    }

    [Fact]
    public async Task ValidateAuthorizationToPostAsync_AllowsAuthorizedUser()
    {
        // Arrange - user 1 has access to all three circles
        var circleIds = new[] { _circleId1, _circleId2, _circleId3 };

        // Act & Assert - No exception means it passed
        using (var context = _fixture.CreateContext())
        {
            await PostService.ValidateAuthorizationToPostAsync(context, circleIds, Array.Empty<Guid>(), _userId1);
        }
    }

    [Fact]
    public async Task ValidateAuthorizationToPostAsync_ThrowsException_ForUnauthorizedCircles()
    {
        // Arrange - user 2 only has access to circles 1 and 3, not 2
        var circleService = CreateCircleService();
        var circleIds = new[] { _circleId1, _circleId2, _circleId3 };

        // Act & Assert
        using (var context = _fixture.CreateContext())
        {
            var exception = await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
                PostService.ValidateAuthorizationToPostAsync(context, circleIds, Array.Empty<Guid>(), _userId2));
            // Verify the error message contains the circle ID
            Assert.Contains(_circleId2.ToString(), exception.Message);
        }
    }

    [Fact]
    public async Task ValidateAuthorizationToPostAsync_ThrowsException_ForInvalidCircles()
    {
        // Arrange
        var invalidCircleId = Guid.NewGuid();
        var circleIds = new[] { _circleId1, invalidCircleId };

        // Act & Assert
        using (var context = _fixture.CreateContext())
        {
            var exception = await Assert.ThrowsAsync<BadHttpRequestException>(() =>
                PostService.ValidateAuthorizationToPostAsync(context, circleIds, Array.Empty<Guid>(), _userId1));
            // Verify the error message contains the circle ID
            Assert.Contains(invalidCircleId.ToString(), exception.Message);
        }
    }

    [Fact]
    public async Task CreateCircleAsync_WithoutMembers_CreatesCircleWithOwnerAsMember()
    {
        // Arrange
        var circleService = CreateCircleService();
        var circleName = "Test Circle Without Members";
        var circleDto = new CircleCreationDto
        {
            Name = circleName,
            IsShared = true,
            UserIdsToAdd = Array.Empty<Guid>()
        };

        // Act
        var result = await circleService.CreateCircleAsync(_userId1, circleDto);

        // Assert - Check return value
        Assert.NotNull(result);
        Assert.Equal(circleName, result.Name);
        Assert.True(result.IsShared);

        // Verify circle was added to database
        using (var context = _fixture.CreateContext())
        {
            var savedCircle = await context.Circles
                .FirstOrDefaultAsync(c => c.Name == circleName);
            Assert.NotNull(savedCircle);
            Assert.Equal(_userId1, savedCircle.OwnerId);

            // Verify owner is added as a member
            var membership = await context.CircleMemberships
                .FirstOrDefaultAsync(m => m.CircleId == savedCircle.Id && m.UserId == _userId1);
            Assert.NotNull(membership);
            Assert.True(membership.IsModerator); // Owner should be a moderator
        }
    }

    [Fact]
    public async Task CreateCircleAsync_WithMembers_AddsAllMembersToCircle()
    {
        // Arrange
        var circleService = CreateCircleService();
        
        // First set up friendship between users (required to add members)
        using (var context = _fixture.CreateContext())
        {
            var friendship1 = new Friendship
            {
                RequesterId = _userId1,
                AddresseeId = _userId2,
                Status = FriendshipStatus.Accepted
            };
            var friendship2 = new Friendship
            {
                RequesterId = _userId1,
                AddresseeId = _userId3,
                Status = FriendshipStatus.Accepted
            };
            await context.Friendships.AddRangeAsync(friendship1, friendship2);
            await context.SaveChangesAsync();
        }

        // Create circle with two members (plus owner)
        var circleDto = new CircleCreationDto
        {
            Name = "Circle With Friends",
            IsShared = true,
            UserIdsToAdd = new[] { _userId1, _userId2, _userId3 } // Including owner ID is redundant but allowed
        };

        // Act
        var result = await circleService.CreateCircleAsync(_userId1, circleDto);

        // Assert
        Assert.NotNull(result);

        // Verify circle was created
        using (var context = _fixture.CreateContext())
        {
            var savedCircle = await context.Circles
                .FirstOrDefaultAsync(c => c.Id == result.Id);
            Assert.NotNull(savedCircle);

            // Verify all memberships were created (should be 3 total: owner + 2 friends)
            var memberships = await context.CircleMemberships
                .Where(m => m.CircleId == result.Id)
                .ToListAsync();

            Assert.Equal(3, memberships.Count);

            // Owner should be a moderator
            var ownerMembership = memberships.FirstOrDefault(m => m.UserId == _userId1);
            Assert.NotNull(ownerMembership);
            Assert.True(ownerMembership.IsModerator);

            // Friends should be regular members
            var friend1Membership = memberships.FirstOrDefault(m => m.UserId == _userId2);
            Assert.NotNull(friend1Membership);
            Assert.False(friend1Membership.IsModerator);

            var friend2Membership = memberships.FirstOrDefault(m => m.UserId == _userId3);
            Assert.NotNull(friend2Membership);
            Assert.False(friend2Membership.IsModerator);
        }
    }

    [Fact]
    public async Task CreateCircleAsync_WithNonFriendUsers_ThrowsException()
    {
        // Arrange
        var circleService = CreateCircleService();
        
        // Create friendotnet dship with user2 but not user3
        using (var context = _fixture.CreateContext())
        {
            var friendship = new Friendship
            {
                RequesterId = _userId1,
                AddresseeId = _userId2,
                Status = FriendshipStatus.Accepted
            };
            await context.Friendships.AddAsync(friendship);
            await context.SaveChangesAsync();
        }

        // Try to create circle with user2 (friend) and user3 (not friend)
        var circleDto = new CircleCreationDto
        {
            Name = "Circle With Non-Friend",
            IsShared = true,
            UserIdsToAdd = new[] { _userId2, _userId3 }
        };

        // Act & Assert
        var exception = await Assert.ThrowsAsync<BadHttpRequestException>(() =>
            circleService.CreateCircleAsync(_userId1, circleDto));

        // Verify error message mentions the non-friend user
        Assert.Contains(_userId3.ToString(), exception.Message);
        Assert.Contains("Cannot add non-friend users", exception.Message);

        // Verify no circle was created in the database
        using (var context = _fixture.CreateContext())
        {
            var circleExists = await context.Circles
                .AnyAsync(c => c.Name == "Circle With Non-Friend");
            Assert.False(circleExists);
        }
    }

    [Fact]
    public async Task CreateCircleAsync_WithNonExistentUser_ThrowsException()
    {
        // Arrange
        var circleService = CreateCircleService();
        var nonExistentUserId = Guid.NewGuid();

        // Create friendship with user2
        using (var context = _fixture.CreateContext())
        {
            var friendship = new Friendship
            {
                RequesterId = _userId1,
                AddresseeId = _userId2,
                Status = FriendshipStatus.Accepted
            };
            await context.Friendships.AddAsync(friendship);
            await context.SaveChangesAsync();
        }

        // Try to create circle with user2 (exists) and a non-existent user
        var circleDto = new CircleCreationDto
        {
            Name = "Circle With Invalid User",
            IsShared = false,
            UserIdsToAdd = new[] { _userId2, nonExistentUserId }
        };

        // Act & Assert
        var exception = await Assert.ThrowsAsync<BadHttpRequestException>(() =>
            circleService.CreateCircleAsync(_userId1, circleDto));

        // Verify error message mentions the invalid user
        Assert.Contains(nonExistentUserId.ToString(), exception.Message);
        Assert.Contains("Cannot add non-friend users to circle: ", exception.Message);

        // Verify no circle was created
        using (var context = _fixture.CreateContext())
        {
            var circleExists = await context.Circles
                .AnyAsync(c => c.Name == "Circle With Invalid User");
            Assert.False(circleExists);
        }
    }

    [Fact]
    public async Task CreateCircleAsync_WithPrivateSetting_CreatesPrivateCircle()
    {
        // Arrange
        var circleService = CreateCircleService();
        var circleDto = new CircleCreationDto
        {
            Name = "Private Circle",
            IsShared = false,
            UserIdsToAdd = Array.Empty<Guid>()
        };

        // Act
        var result = await circleService.CreateCircleAsync(_userId1, circleDto);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("Private Circle", result.Name);
        Assert.False(result.IsShared);

        // Verify circle was saved as private
        using (var context = _fixture.CreateContext())
        {
            var savedCircle = await context.Circles
                .FirstOrDefaultAsync(c => c.Id == result.Id);
            Assert.NotNull(savedCircle);
            Assert.False(savedCircle.IsShared);
        }
    }

    [Fact]
    public async Task CreateCircleAsync_WithInvalidCreator_ThrowsException()
    {
        // Arrange
        var circleService = CreateCircleService();
        var invalidUserId = Guid.NewGuid();
        var circleDto = new CircleCreationDto
        {
            Name = "Invalid Creator Circle",
            IsShared = true
        };

        // Act & Assert
        var exception = await Assert.ThrowsAsync<BadHttpRequestException>(() =>
            circleService.CreateCircleAsync(invalidUserId, circleDto));

        Assert.Contains(invalidUserId.ToString(), exception.Message);
        Assert.Contains("Cannot create post for invalid user", exception.Message);
    }

    [Fact]
    public async Task CreateCircleAsync_WithFriendshipPendingUser_ThrowsException()
    {
        // Arrange
        var circleService = CreateCircleService();
        
        // Create pending friendship with user2
        using (var context = _fixture.CreateContext())
        {
            var pendingFriendship = new Friendship
            {
                RequesterId = _userId1,
                AddresseeId = _userId2,
                Status = FriendshipStatus.Pending // Not accepted yet
            };
            await context.Friendships.AddAsync(pendingFriendship);
            await context.SaveChangesAsync();
        }

        // Try to create circle with user2 (pending friend)
        var circleDto = new CircleCreationDto
        {
            Name = "Circle With Pending Friend",
            IsShared = true,
            UserIdsToAdd = new[] { _userId2 }
        };

        // Act & Assert
        var exception = await Assert.ThrowsAsync<BadHttpRequestException>(() =>
            circleService.CreateCircleAsync(_userId1, circleDto));

        // Should reject since friendship status is not Accepted
        Assert.Contains(_userId2.ToString(), exception.Message);
        Assert.Contains("Cannot add non-friend users", exception.Message);
    }

    [Fact]
    public async Task CreateCircleAsync_AddsOwnerOnlyOnce_EvenIfIncludedInUserIdsToAdd()
    {
        // Arrange
        var circleService = CreateCircleService();
        var circleDto = new CircleCreationDto
        {
            Name = "Circle With Owner In UserIds",
            IsShared = true,
            UserIdsToAdd = new[] { _userId1 } // Owner is also in the UserIdsToAdd
        };

        // Act
        var result = await circleService.CreateCircleAsync(_userId1, circleDto);

        // Assert
        Assert.NotNull(result);

        // Verify only one membership was created for the owner (no duplication)
        using (var context = _fixture.CreateContext())
        {
            var memberships = await context.CircleMemberships
                .Where(m => m.CircleId == result.Id)
                .ToListAsync();

            Assert.Single(memberships);
            Assert.Equal(_userId1, memberships[0].UserId);
            Assert.True(memberships[0].IsModerator);
        }
    }
}