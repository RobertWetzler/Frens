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
    /// <summary>
    /// Gets recommended friends based on mutual connections.
    /// Returns users who share the most friends with the given user,
    /// excluding existing friends and pending requests.
    /// </summary>
    Task<List<RecommendedFriendDto>> GetRecommendedFriendsAsync(Guid userId, int limit = 5, int minimumMutualFriends = 2);
    
    /// <summary>
    /// Gets recommended friends using a single raw SQL query.
    /// This is an alternative implementation for performance comparison.
    /// </summary>
    Task<List<RecommendedFriendDto>> GetRecommendedFriendsRawSqlAsync(Guid userId, int limit = 5, int minimumMutualFriends = 2);
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

    /// <summary>
    /// Gets recommended friends based on mutual connections using four queries.
    /// 
    /// Algorithm:
    /// 1. Get all user's current friends
    /// 2. Get all friendships involving those friends (friends-of-friends)
    /// 3. Filter out: self, existing friends, pending requests
    /// 4. Group by potential friend and count distinct mutual connections
    /// 5. Return top N sorted by mutual friend count
    /// 
    /// Complexity: O(F × A) where F = friend count, A = avg friends per friend
    /// Database: 2 queries - one for aggregation, one for user details
    /// </summary>
    public async Task<List<RecommendedFriendDto>> GetRecommendedFriendsAsync(Guid userId, int limit = 5, int minimumMutualFriends = 2)
    {
        // Step 1: Get my friend IDs (materialized to avoid complex subquery translation issues)
        var myFriendIds = await _dbContext.Friendships
            .Where(f => f.Status == FriendshipStatus.Accepted &&
                       (f.RequesterId == userId || f.AddresseeId == userId))
            .Select(f => f.RequesterId == userId ? f.AddresseeId : f.RequesterId)
            .ToListAsync();
        
        if (!myFriendIds.Any())
            return new List<RecommendedFriendDto>();
        
        // Step 2: Get users to exclude (self + friends + pending requests)
        var pendingUserIds = await _dbContext.Friendships
            .Where(f => f.Status == FriendshipStatus.Pending &&
                       (f.RequesterId == userId || f.AddresseeId == userId))
            .Select(f => f.RequesterId == userId ? f.AddresseeId : f.RequesterId)
            .ToListAsync();
        
        var excludedUserIds = myFriendIds
            .Concat(pendingUserIds)
            .Append(userId)
            .ToHashSet();
        
        // Step 3: Get friends-of-friends data
        // Query friendships where either party is one of my friends
        var fofData = await _dbContext.Friendships
            .Where(f => f.Status == FriendshipStatus.Accepted &&
                       (myFriendIds.Contains(f.RequesterId) || myFriendIds.Contains(f.AddresseeId)))
            .Select(f => new
            {
                f.RequesterId,
                f.AddresseeId
            })
            .ToListAsync();
        
        // Step 4: Process in memory to extract FoF relationships
        // For each friendship, determine who is my friend and who is the FoF
        var friendsOfFriends = fofData
            .Select(f => 
            {
                bool requesterIsMyFriend = myFriendIds.Contains(f.RequesterId);
                return new
                {
                    FoFId = requesterIsMyFriend ? f.AddresseeId : f.RequesterId,
                    ViaFriendId = requesterIsMyFriend ? f.RequesterId : f.AddresseeId
                };
            })
            .Where(x => !excludedUserIds.Contains(x.FoFId))
            .ToList();
        
        // Step 5: Group by FoF, count distinct mutual friends, filter and sort
        var recommendations = friendsOfFriends
            .GroupBy(x => x.FoFId)
            .Select(g => new
            {
                UserId = g.Key,
                MutualFriendCount = g.Select(x => x.ViaFriendId).Distinct().Count()
            })
            .Where(x => x.MutualFriendCount >= minimumMutualFriends)
            .OrderByDescending(x => x.MutualFriendCount)
            .Take(limit)
            .ToList();
        
        if (!recommendations.Any())
            return new List<RecommendedFriendDto>();
        
        // Step 6: Fetch user details for the recommendations
        var userIds = recommendations.Select(r => r.UserId).ToList();
        var users = await _dbContext.Users
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.Name, u.ProfilePictureKey })
            .ToDictionaryAsync(u => u.Id);
        
        return recommendations
            .Where(r => users.ContainsKey(r.UserId))
            .Select(r => new RecommendedFriendDto
            {
                User = new UserDto
                {
                    Id = r.UserId,
                    Name = users[r.UserId].Name,
                    ProfilePictureUrl = !string.IsNullOrEmpty(users[r.UserId].ProfilePictureKey)
                        ? _storage.GetProfilePictureUrl(users[r.UserId].ProfilePictureKey)
                        : null
                },
                MutualFriendCount = r.MutualFriendCount
            })
            .OrderByDescending(r => r.MutualFriendCount)
            .ToList();
    }
    
    public async Task<List<RecommendedFriendDto>> GetRecommendedFriendsRawSqlAsync(
        Guid userId, 
        int limit = 5, 
        int minimumMutualFriends = 2)
    {
        // Raw SQL implementation using CTEs for a single database call
        var sql = @"
            WITH my_friends AS (
                -- Get all users the current user is friends with (accepted status = 1)
                SELECT 
                    CASE WHEN ""RequesterId"" = @userId THEN ""AddresseeId"" ELSE ""RequesterId"" END AS friend_id
                FROM ""Friendships""
                WHERE (""RequesterId"" = @userId OR ""AddresseeId"" = @userId)
                  AND ""Status"" = 1
            ),
            excluded_users AS (
                -- Users we should NOT recommend:
                -- 1. The current user themselves
                -- 2. Users already friends with current user
                -- 3. Users with any pending/rejected/blocked relationship with current user
                SELECT @userId AS user_id
                UNION
                SELECT friend_id FROM my_friends
                UNION
                SELECT 
                    CASE WHEN ""RequesterId"" = @userId THEN ""AddresseeId"" ELSE ""RequesterId"" END
                FROM ""Friendships""
                WHERE (""RequesterId"" = @userId OR ""AddresseeId"" = @userId)
                  AND ""Status"" != 1
            ),
            friends_of_friends AS (
                -- Get friends of my friends, excluding users in excluded_users
                SELECT 
                    CASE WHEN f.""RequesterId"" = mf.friend_id THEN f.""AddresseeId"" ELSE f.""RequesterId"" END AS fof_id,
                    mf.friend_id AS via_friend_id
                FROM ""Friendships"" f
                INNER JOIN my_friends mf ON (f.""RequesterId"" = mf.friend_id OR f.""AddresseeId"" = mf.friend_id)
                WHERE f.""Status"" = 1
                  AND CASE WHEN f.""RequesterId"" = mf.friend_id THEN f.""AddresseeId"" ELSE f.""RequesterId"" END NOT IN (SELECT user_id FROM excluded_users)
            )
            SELECT 
                fof.fof_id AS ""Id"",
                u.""Name"",
                u.""ProfilePictureKey"",
                COUNT(DISTINCT fof.via_friend_id) AS ""MutualFriendCount""
            FROM friends_of_friends fof
            INNER JOIN ""AspNetUsers"" u ON u.""Id"" = fof.fof_id
            GROUP BY fof.fof_id, u.""Name"", u.""ProfilePictureKey""
            HAVING COUNT(DISTINCT fof.via_friend_id) >= @minimumMutualFriends
            ORDER BY COUNT(DISTINCT fof.via_friend_id) DESC
            LIMIT @limit";
        
        var results = await _dbContext.Database
            .SqlQueryRaw<RawRecommendedFriendResult>(
                sql,
                new Npgsql.NpgsqlParameter("@userId", userId),
                new Npgsql.NpgsqlParameter("@minimumMutualFriends", minimumMutualFriends),
                new Npgsql.NpgsqlParameter("@limit", limit))
            .ToListAsync();
        
        return results.Select(r => new RecommendedFriendDto
        {
            User = new UserDto
            {
                Id = r.Id,
                Name = r.Name,
                ProfilePictureUrl = !string.IsNullOrEmpty(r.ProfilePictureKey)
                    ? _storage.GetProfilePictureUrl(r.ProfilePictureKey)
                    : null
            },
            MutualFriendCount = r.MutualFriendCount
        }).ToList();
    }
    
    // Helper class for raw SQL query result mapping
    private class RawRecommendedFriendResult
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = "";
        public string? ProfilePictureKey { get; set; }
        public int MutualFriendCount { get; set; }
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