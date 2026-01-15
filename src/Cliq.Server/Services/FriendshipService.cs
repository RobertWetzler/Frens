using AutoMapper;
using Cliq.Server.Data;
using Cliq.Server.Models;
using Cliq.Server.Services;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;


public class FriendshipDto
{
    public required string Id { get; set; }
    public required UserDto Requester { get; set; }
    public required UserDto Addressee { get; set; }
    public FriendshipStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? AcceptedAt { get; set; }
}

public interface IFriendshipService
{
    Task<FriendshipDto> SendFriendRequestAsync(Guid requesterId, Guid addresseeId);
    Task<FriendshipDto> AcceptFriendRequestAsync(Guid friendshipId, Guid userId);
    Task<bool> RejectFriendRequestAsync(Guid friendshipId, Guid userId);
    Task<bool> CancelFriendRequestAsync(Guid friendshipId, Guid userId);
    Task<bool> RemoveFriendshipAsync(Guid userId, Guid friendId);
    Task<bool> BlockUserAsync(Guid userId, Guid userToBlockId);
    Task<IEnumerable<FriendRequestDto>> GetFriendRequestsAsync(Guid userId, bool includeAddressee = false);
    Task<int> GetFriendRequestsCountAsync(Guid userId);
    Task<IEnumerable<UserDto>> GetFriendsAsync(Guid userId);
    Task<bool> AreFriendsAsync(Guid userId1, Guid userId2);
    Task<Friendship?> GetFriendshipByUserIdsAsync(Guid userId1, Guid userId2);
    Task<FriendshipStatusDto> GetFriendshipStatusAsync(Guid currentUserId, Guid targetUserId);
}

public class FriendshipService : IFriendshipService
{
    private readonly CliqDbContext _dbContext;
    private readonly IMapper _mapper;
    private readonly IEventNotificationService? _eventNotificationService;
    private readonly IObjectStorageService _storage;

    public FriendshipService(CliqDbContext dbContext, IMapper mapper, IObjectStorageService storage, IEventNotificationService? eventNotificationService = null)
    {
        _dbContext = dbContext;
        _mapper = mapper;
        _storage = storage;
        _eventNotificationService = eventNotificationService;
    }

    public async Task<FriendshipDto> SendFriendRequestAsync(Guid requesterId, Guid addresseeId)
    {
        // Prevent sending request to self
        if (requesterId == addresseeId)
            throw new ArgumentException("Cannot send a friend request to yourself");

        // Check if users exist
        var requester = await _dbContext.Users.FindAsync(requesterId);
        var addressee = await _dbContext.Users.FindAsync(addresseeId);

        if (requester == null || addressee == null)
            throw new ArgumentException("One or both users not found");

        // Check if a friendship already exists in either direction
        var existingFriendship = await _dbContext.Friendships
            .FirstOrDefaultAsync(f =>
                (f.RequesterId == requesterId && f.AddresseeId == addresseeId) ||
                (f.RequesterId == addresseeId && f.AddresseeId == requesterId));

        if (existingFriendship != null)
        {
            // Handle cases based on existing relationship
            if (existingFriendship.Status == FriendshipStatus.Blocked)
                throw new InvalidOperationException("Cannot send a friend request to this user");

            if (existingFriendship.Status == FriendshipStatus.Accepted)
                throw new InvalidOperationException("Already friends with this user");

            if (existingFriendship.Status == FriendshipStatus.Pending)
            {
                // If the addressee previously sent a request to the requester, accept it
                if (existingFriendship.RequesterId == addresseeId)
                {
                    existingFriendship.Status = FriendshipStatus.Accepted;
                    existingFriendship.AcceptedAt = DateTime.UtcNow;
                    await _dbContext.SaveChangesAsync();

                    // Reload friendship with user details
                    var friendship = await GetFriendshipWithDetailsAsync(existingFriendship.Id);
                    return _mapper.Map<FriendshipDto>(friendship);
                }

                throw new InvalidOperationException("Friend request already sent");
            }

            if (existingFriendship.Status == FriendshipStatus.Rejected)
            {
                // Allow re-sending after rejection
                existingFriendship.Status = FriendshipStatus.Pending;
                existingFriendship.CreatedAt = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync();

                // Reload friendship with user details
                var friendship = await GetFriendshipWithDetailsAsync(existingFriendship.Id);
                return _mapper.Map<FriendshipDto>(friendship);
            }
        }

        // Create new friend request
        var newFriendship = new Friendship
        {
            Id = Guid.NewGuid(),
            RequesterId = requesterId,
            AddresseeId = addresseeId,
            Status = FriendshipStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };

        await _dbContext.Friendships.AddAsync(newFriendship);
        await _dbContext.SaveChangesAsync();

        // Send notification to addressee
        try
        {
            _eventNotificationService?.SendFriendRequestNotificationAsync(requesterId, addresseeId, newFriendship.Id, requester.Name);
        }
        catch (Exception ex)
        {
            // Log error but don't fail the friend request
            Console.WriteLine($"Failed to send friend request notification: {ex.Message}");
        }

        // Reload friendship with user details
        var newFriendshipWithDetails = await GetFriendshipWithDetailsAsync(newFriendship.Id);
        return _mapper.Map<FriendshipDto>(newFriendshipWithDetails);
    }

    public async Task<FriendshipDto> AcceptFriendRequestAsync(Guid friendshipId, Guid userId)
    {
        var friendship = await _dbContext.Friendships
            .Include(f => f.Requester)
            .Include(f => f.Addressee)
            .FirstOrDefaultAsync(f => f.Id == friendshipId && f.AddresseeId == userId);

        if (friendship == null)
            throw new ArgumentException("Friend request not found or you don't have permission to accept it");

        if (friendship.Status != FriendshipStatus.Pending)
            throw new InvalidOperationException("This request cannot be accepted");

        friendship.Status = FriendshipStatus.Accepted;
        friendship.AcceptedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();

        // Send notification to requester
        try
        {
            _eventNotificationService?.SendFriendRequestAcceptedNotificationAsync(userId, friendship.RequesterId, friendship.Addressee.Name);
        }
        catch (Exception ex)
        {
            // Log error but don't fail the acceptance
            Console.WriteLine($"Failed to send friend request accepted notification: {ex.Message}");
        }

        // Reload friendship with user details
        var updatedFriendship = await GetFriendshipWithDetailsAsync(friendship.Id);
        return _mapper.Map<FriendshipDto>(updatedFriendship);
    }

    public async Task<bool> RejectFriendRequestAsync(Guid friendshipId, Guid userId)
    {
        var friendship = await _dbContext.Friendships
            .FirstOrDefaultAsync(f => f.Id == friendshipId && f.AddresseeId == userId);

        if (friendship == null)
            return false;

        friendship.Status = FriendshipStatus.Rejected;
        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<bool> CancelFriendRequestAsync(Guid friendshipId, Guid userId)
    {
        var friendship = await _dbContext.Friendships
            .FirstOrDefaultAsync(f => f.Id == friendshipId && f.RequesterId == userId && f.Status == FriendshipStatus.Pending);

        if (friendship == null)
            return false;

        _dbContext.Friendships.Remove(friendship);
        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RemoveFriendshipAsync(Guid userId, Guid friendId)
    {
        var friendship = await _dbContext.Friendships
            .FirstOrDefaultAsync(f =>
                ((f.RequesterId == userId && f.AddresseeId == friendId) ||
                (f.RequesterId == friendId && f.AddresseeId == userId)) &&
                f.Status == FriendshipStatus.Accepted);

        if (friendship == null)
            return false;

        _dbContext.Friendships.Remove(friendship);
        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<bool> BlockUserAsync(Guid userId, Guid userToBlockId)
    {
        // Remove any existing friendship
        var existingFriendship = await _dbContext.Friendships
            .FirstOrDefaultAsync(f =>
                (f.RequesterId == userId && f.AddresseeId == userToBlockId) ||
                (f.RequesterId == userToBlockId && f.AddresseeId == userId));

        if (existingFriendship != null)
        {
            // Convert to blocked status
            existingFriendship.Status = FriendshipStatus.Blocked;
            // Ensure the blocker is always the requester
            if (existingFriendship.RequesterId != userId)
            {
                existingFriendship.RequesterId = userId;
                existingFriendship.AddresseeId = userToBlockId;
            }
        }
        else
        {
            // Create a new blocked relationship
            var blockFriendship = new Friendship
            {
                Id = Guid.NewGuid(),
                RequesterId = userId,
                AddresseeId = userToBlockId,
                Status = FriendshipStatus.Blocked,
                CreatedAt = DateTime.UtcNow
            };

            await _dbContext.Friendships.AddAsync(blockFriendship);
        }

        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<IEnumerable<FriendRequestDto>> GetFriendRequestsAsync(Guid userId, bool includeAddressee = false)
    {
        var query = _dbContext.Friendships
                .Where(f => f.AddresseeId == userId && f.Status == FriendshipStatus.Pending)
                .Include(f => f.Requester);
        if (includeAddressee)
        {
            query.Include(f => f.Addressee);
        }
        var friendRequests = await query.ToListAsync();

        return _mapper.Map<IEnumerable<FriendRequestDto>>(friendRequests);
    }

    public async Task<int> GetFriendRequestsCountAsync(Guid userId)
    {
        return await _dbContext.Friendships
            .Where(f => f.AddresseeId == userId && f.Status == FriendshipStatus.Pending)
            .CountAsync();
    }

    public async Task<Friendship?> GetFriendshipByUserIdsAsync(Guid userId1, Guid userId2)
    {
        return await _dbContext.Friendships
            .Include(f => f.Requester)
            .Include(f => f.Addressee)
            .FirstOrDefaultAsync(f =>
                (f.RequesterId == userId1 && f.AddresseeId == userId2) ||
                (f.RequesterId == userId2 && f.AddresseeId == userId1));
    }

    public async Task<IEnumerable<UserDto>> GetFriendsAsync(Guid userId)
    {
        var friends = new List<User>();

        // Get friends where user is the requester
        var friendshipsAsRequester = await _dbContext.Friendships
            .Where(f => f.RequesterId == userId && f.Status == FriendshipStatus.Accepted)
            .Include(f => f.Addressee)
            .ToListAsync();

        friends.AddRange(friendshipsAsRequester.Select(f => f.Addressee));

        // Get friends where user is the addressee
        var friendshipsAsAddressee = await _dbContext.Friendships
            .Where(f => f.AddresseeId == userId && f.Status == FriendshipStatus.Accepted)
            .Include(f => f.Requester)
            .ToListAsync();

        friends.AddRange(friendshipsAsAddressee.Select(f => f.Requester));

        var userDtos = _mapper.Map<IEnumerable<UserDto>>(friends).ToList();
        
        // Set profile picture URLs
        foreach (var dto in userDtos)
        {
            var user = friends.FirstOrDefault(f => f.Id == dto.Id);
            if (user != null && !string.IsNullOrEmpty(user.ProfilePictureKey))
            {
                dto.ProfilePictureUrl = _storage.GetProfilePictureUrl(user.ProfilePictureKey);
            }
        }
        
        return userDtos;
    }

    public async Task<bool> AreFriendsAsync(Guid userId1, Guid userId2)
    {
        return await _dbContext.Friendships
            .AnyAsync(f =>
                ((f.RequesterId == userId1 && f.AddresseeId == userId2) ||
                (f.RequesterId == userId2 && f.AddresseeId == userId1)) &&
                f.Status == FriendshipStatus.Accepted);
    }

    private async Task<Friendship?> GetFriendshipWithDetailsAsync(Guid friendshipId)
    {
        return await _dbContext.Friendships
            .Include(f => f.Requester)
            .Include(f => f.Addressee)
            .FirstOrDefaultAsync(f => f.Id == friendshipId);
    }

    public async Task<FriendshipStatusDto> GetFriendshipStatusAsync(Guid currentUserId, Guid targetUserId)
    {
        // Check if users are friends
        bool areFriends = await AreFriendsAsync(currentUserId, targetUserId);
        if (areFriends)
        {
            return new FriendshipStatusDto
            {
                Status = VisibleStatus.Friends
            };
        }

        // Check for pending friend requests in either direction
        var pendingRequests = await GetFriendshipByUserIdsAsync(currentUserId, targetUserId);

        if (pendingRequests != null)
        {
            if (pendingRequests.Status == FriendshipStatus.Pending)
            {
                if (pendingRequests.RequesterId == currentUserId)
                {
                    // Current user sent the request
                    return new FriendshipStatusDto
                    {
                        Status = VisibleStatus.PendingSent,
                        FriendshipId = pendingRequests.Id
                    };
                }
                else
                {
                    // Current user received the request
                    return new FriendshipStatusDto
                    {
                        Status = VisibleStatus.PendingReceived,
                        FriendshipId = pendingRequests.Id
                    };
                }
            }
            else if (pendingRequests.Status == FriendshipStatus.Blocked)
            {
                if (pendingRequests.RequesterId == currentUserId)
                {
                    // Current user blocked the target user
                    return new FriendshipStatusDto
                    {
                        Status = VisibleStatus.Blocked,
                        FriendshipId = pendingRequests.Id
                    };
                }
                else
                {
                    // Current user was blocked by target user
                    return new FriendshipStatusDto
                    {
                        Status = VisibleStatus.BlockedBy,
                    };
                }
            }
        }

        // Default - no relationship
        return new FriendshipStatusDto
        {
            Status = VisibleStatus.None
        };
    }
}



// Extension method for dependency injection
public static class FriendshipServiceExtensions
{
    public static IServiceCollection AddFriendshipServices(this IServiceCollection services)
    {
        services.AddScoped<IFriendshipService, FriendshipService>();
        return services;
    }
}