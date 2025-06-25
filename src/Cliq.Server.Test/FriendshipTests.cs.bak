using AutoMapper;
using Cliq.Server.Data;
using Cliq.Server.Models;
using Cliq.Server.Services;
using Cliq.Server.Utilities;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;
using Xunit;

public class FriendshipTests : DatabaseTestBase
{
    private Guid _user1Id;
    private Guid _user2Id;
    private Guid _user3Id;
    private Guid _pendingFriendshipId;
    private Guid _acceptedFriendshipId;

    private IFriendshipService _friendshipService = null!;
    private IMapper _mapper;

    public FriendshipTests() : base()
    {
        // Initialize stateless members that are the same for all tests
        _mapper = CliqMappingHelper.CreateMapper();
    }

    protected override async Task SetupTestDataAsync(CliqDbContext context)
    {
        // Create test users
        var user1 = new User
        {
            Id = Guid.NewGuid(),
            Name = "Test User One",
            Email = "user1@example.com",
            UserName = "testuser1"
        };

        var user2 = new User
        {
            Id = Guid.NewGuid(),
            Name = "Test User Two",
            Email = "user2@example.com",
            UserName = "testuser2"
        };

        var user3 = new User
        {
            Id = Guid.NewGuid(),
            Name = "Test User Three",
            Email = "user3@example.com",
            UserName = "testuser3"
        };

        // Create a pending friendship from user1 to user2
        var pendingFriendship = new Friendship
        {
            Id = Guid.NewGuid(),
            RequesterId = user1.Id,
            AddresseeId = user2.Id,
            Status = FriendshipStatus.Pending,
            CreatedAt = DateTime.UtcNow.AddDays(-1)
        };

        // Create an accepted friendship between user1 and user3
        var acceptedFriendship = new Friendship
        {
            Id = Guid.NewGuid(),
            RequesterId = user1.Id,
            AddresseeId = user3.Id,
            Status = FriendshipStatus.Accepted,
            CreatedAt = DateTime.UtcNow.AddDays(-2),
            AcceptedAt = DateTime.UtcNow.AddDays(-1)
        };

        await context.Users.AddRangeAsync(user1, user2, user3);
        await context.Friendships.AddRangeAsync(pendingFriendship, acceptedFriendship);

        _user1Id = user1.Id;
        _user2Id = user2.Id;
        _user3Id = user3.Id;
        _pendingFriendshipId = pendingFriendship.Id;
        _acceptedFriendshipId = acceptedFriendship.Id;

        _friendshipService = new FriendshipService(context, _mapper);
    }

    #region Data querying tests
    [Fact]
    public async Task CanQueryPendingFriendRequests()
    {
        // Act
        var pendingRequests = await Context.Friendships
            .Where(f => f.AddresseeId == _user2Id && f.Status == FriendshipStatus.Pending)
            .ToListAsync();

        // Assert
        Assert.Single(pendingRequests);
        Assert.Equal(_user1Id, pendingRequests[0].RequesterId);
        Assert.Equal(FriendshipStatus.Pending, pendingRequests[0].Status);
    }

    [Fact]
    public async Task CanQueryAcceptedFriendships()
    {
        // Act
        var friendships = await Context.Friendships
            .Where(f => 
                (f.RequesterId == _user1Id || f.AddresseeId == _user1Id) && 
                f.Status == FriendshipStatus.Accepted)
            .ToListAsync();

        // Assert
        Assert.Single(friendships);
        Assert.Equal(_user3Id, friendships[0].AddresseeId);
        Assert.NotNull(friendships[0].AcceptedAt);
    }
    #endregion

    #region Service tests
    [Fact]
    public async Task CanSendFriendRequest()
    {
        // Arrange - Send a request from user2 to user3
        
        // Act
        var result = await _friendshipService.SendFriendRequestAsync(_user2Id, _user3Id);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(_user2Id, result.Requester.Id);
        Assert.Equal(_user3Id, result.Addressee.Id);
        Assert.Equal(FriendshipStatus.Pending, result.Status);

        // Verify database state
        var friendshipInDb = await Context.Friendships
            .FirstOrDefaultAsync(f => f.RequesterId == _user2Id && f.AddresseeId == _user3Id);
        Assert.NotNull(friendshipInDb);
        Assert.Equal(FriendshipStatus.Pending, friendshipInDb.Status);
    }

    [Fact]
    public async Task CannotSendDuplicateFriendRequest()
    {
        // Act & Assert - Should throw when trying to send a duplicate request
        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            await _friendshipService.SendFriendRequestAsync(_user1Id, _user2Id));
    }

    [Fact]
    public async Task CanAcceptFriendRequest()
    {
        // Act
        var result = await _friendshipService.AcceptFriendRequestAsync(_pendingFriendshipId, _user2Id);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(FriendshipStatus.Accepted, result.Status);
        Assert.NotNull(result.AcceptedAt);

        // Verify database state
        var friendshipInDb = await Context.Friendships.FindAsync(_pendingFriendshipId);
        Assert.NotNull(friendshipInDb);
        Assert.Equal(FriendshipStatus.Accepted, friendshipInDb.Status);
        Assert.NotNull(friendshipInDb.AcceptedAt);
    }

    [Fact]
    public async Task CannotAcceptFriendRequestAsRequester()
    {
        // Act & Assert - User1 cannot accept their own request
        await Assert.ThrowsAsync<ArgumentException>(async () => 
            await _friendshipService.AcceptFriendRequestAsync(_pendingFriendshipId, _user1Id));
    }

    [Fact]
    public async Task CanRejectFriendRequest()
    {
        // Act
        var result = await _friendshipService.RejectFriendRequestAsync(_pendingFriendshipId, _user2Id);

        // Assert
        Assert.True(result);

        // Verify database state
        var friendshipInDb = await Context.Friendships.FindAsync(_pendingFriendshipId);
        Assert.NotNull(friendshipInDb);
        Assert.Equal(FriendshipStatus.Rejected, friendshipInDb.Status);
    }

    [Fact]
    public async Task CanRemoveFriendship()
    {
        // Act
        var result = await _friendshipService.RemoveFriendshipAsync(_user1Id, _user3Id);

        // Assert
        Assert.True(result);

        // Verify database state - friendship should be removed
        var friendshipInDb = await Context.Friendships.FindAsync(_acceptedFriendshipId);
        Assert.Null(friendshipInDb);
    }

    [Fact]
    public async Task CanGetFriendRequests()
    {
        // Act
        var requests = (await _friendshipService.GetFriendRequestsAsync(_user2Id)).ToList();

        // Assert
        Assert.Single(requests);
        Assert.Equal(_user1Id, requests[0].Requester.Id);
        Assert.Equal(_user2Id, requests[0].Addressee.Id);
        Assert.Equal(FriendshipStatus.Pending, requests[0].Status);
    }

    [Fact]
    public async Task CanGetFriends()
    {
        // Act
        var friends = (await _friendshipService.GetFriendsAsync(_user1Id)).ToList();

        // Assert
        Assert.Single(friends);
        Assert.Equal(_user3Id, friends[0].Id);
    }

    [Fact]
    public async Task CanCheckIfUsersAreFriends()
    {
        // Act & Assert
        Assert.True(await _friendshipService.AreFriendsAsync(_user1Id, _user3Id));
        Assert.False(await _friendshipService.AreFriendsAsync(_user1Id, _user2Id));
    }

    [Fact]
    public async Task CanBlockUser()
    {
        // Act
        var result = await _friendshipService.BlockUserAsync(_user3Id, _user2Id);

        // Assert
        Assert.True(result);

        // Verify database state
        var blockInDb = await Context.Friendships
            .FirstOrDefaultAsync(f => f.RequesterId == _user3Id && f.AddresseeId == _user2Id);
        Assert.NotNull(blockInDb);
        Assert.Equal(FriendshipStatus.Blocked, blockInDb.Status);
    }

    [Fact]
    public async Task BlockingReplacesExistingFriendship()
    {
        // Act - Block someone who was already a friend
        var result = await _friendshipService.BlockUserAsync(_user1Id, _user3Id);

        // Assert
        Assert.True(result);

        // Verify database state - should be converted to blocked
        var friendshipInDb = await Context.Friendships.FindAsync(_acceptedFriendshipId);
        Assert.NotNull(friendshipInDb);
        Assert.Equal(FriendshipStatus.Blocked, friendshipInDb.Status);
        Assert.Equal(_user1Id, friendshipInDb.RequesterId); // User1 should be the blocker
        Assert.Equal(_user3Id, friendshipInDb.AddresseeId);
    }

    [Fact]
    public async Task SendFriendRequestAutoAcceptsReciprocal()
    {
        // Arrange - User2 sends request to User1 who already sent them a request
        
        // Act
        var result = await _friendshipService.SendFriendRequestAsync(_user2Id, _user1Id);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(FriendshipStatus.Accepted, result.Status);
        Assert.NotNull(result.AcceptedAt);

        // Verify database state - original request should be accepted
        var friendshipInDb = await Context.Friendships.FindAsync(_pendingFriendshipId);
        Assert.NotNull(friendshipInDb);
        Assert.Equal(FriendshipStatus.Accepted, friendshipInDb.Status);
    }
    #endregion
}