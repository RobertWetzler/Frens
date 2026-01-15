using AutoMapper;
using Cliq.Server.Data;
using Cliq.Server.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualBasic;

namespace Cliq.Server.Services;

public interface ICircleService
{
    Task<CirclePublicDto> GetCircleAsync(Guid requestorId, Guid circleId);
    Task<CirclePublicDto> CreateCircleAsync(Guid creatorId, CircleCreationDto circleDto);
    Task<IEnumerable<CirclePublicDto>> GetUserOwnedCirclesAsync(Guid userId);
    Task<IEnumerable<CirclePublicDto>> GetUserMemberCirclesAsync(Guid userId);
    Task<IEnumerable<CircleWithMembersDto>> GetUserCirclesWithMembersAsync(Guid userId);
    Task DeleteCircleAsync(Guid requestorId, Guid circleId);
    Task FollowCircle(Guid userId, Guid circleId, Guid? notificationId);
    Task DenyFollowCircle(Guid userId, Guid notificationId);
    Task UnfollowCircle(Guid userId, Guid circleId);
    Task AddUsersToCircleAsync(Guid requestorId, Guid circleId, Guid[] userIdsToAdd);
    Task RemoveUsersFromCircleAsync(Guid userId, Guid circleId, Guid[] userIds);
}

public class CircleService : ICircleService
{
    private readonly CliqDbContext _dbContext;
    private readonly ICommentService _commentService;
    private readonly IFriendshipService _friendshipService;
    private readonly IMapper _mapper;
    private readonly IEventNotificationService _eventNotificationService;
    private readonly ILogger<CircleService> _logger;
    private readonly IObjectStorageService _storage;

    public CircleService(
        CliqDbContext dbContext,
        ICommentService commentService,
        IFriendshipService friendshipService,
        IMapper mapper,
        IEventNotificationService eventNotificationService,
        ILogger<CircleService> logger,
        IObjectStorageService storage)
    {
        _dbContext = dbContext;
        _commentService = commentService;
        _friendshipService = friendshipService;
        _mapper = mapper;
        _eventNotificationService = eventNotificationService;
        _logger = logger;
        _storage = storage;
    }

    public async Task<CirclePublicDto> CreateCircleAsync(Guid creatorId, CircleCreationDto circleDto)
    {
        // TODO: Use a method from UserService for finding User by ID
        var creator = await this._dbContext.Users.FirstOrDefaultAsync(u => u.Id == creatorId) 
            ?? throw new BadHttpRequestException($"Cannot create post for invalid user {creatorId}");

        // Start a transaction to ensure all operations succeed or fail together
        using var transaction = await _dbContext.Database.BeginTransactionAsync();
        try
        {
            var circle = new Circle
            {
                Id = Guid.NewGuid(),
                OwnerId = creatorId,
                Name = circleDto.Name,
                IsShared = circleDto.IsShared,
                IsSubscribable = circleDto.IsSubscribable
            };
            var entry = await _dbContext.Circles.AddAsync(circle);
            await _dbContext.SaveChangesAsync();

            // Add owner as a member
            await _dbContext.CircleMemberships.AddAsync(new CircleMembership
            {
                CircleId = circle.Id,
                UserId = creatorId,
                IsModerator = true // Owner is automatically a moderator
            });

            var userIdsToAdd = circleDto.UserIdsToAdd;
            // Validate users are friends with the creator
            if (userIdsToAdd != null && userIdsToAdd.Length > 0)
            {
                var creatorFriends = await _dbContext.Friendships
                    .Where(f => (f.RequesterId == creatorId || f.AddresseeId == creatorId) &&
                                f.Status == FriendshipStatus.Accepted)
                    .Select(f => f.RequesterId == creatorId ? f.AddresseeId : f.RequesterId)
                    .ToListAsync();

                var nonFriendIds = userIdsToAdd.Where(id => id != creatorId && !creatorFriends.Contains(id)).ToList();
                if (nonFriendIds.Any())
                {
                    throw new BadHttpRequestException($"Cannot add non-friend users to circle: {string.Join(", ", nonFriendIds)}");
                }

                // Verify all users exist
                var existingUserIds = await _dbContext.Users
                    .Where(u => userIdsToAdd.Contains(u.Id))
                    .Select(u => u.Id)
                    .ToListAsync();

                var invalidUserIds = userIdsToAdd.Where(id => !existingUserIds.Contains(id)).ToList();
                if (invalidUserIds.Any())
                {
                    throw new BadHttpRequestException($"Cannot add non-existent users to circle: {string.Join(", ", invalidUserIds)}");
                }

                // Add all valid friend users to the circle (excluding creator as they're already added)
                var memberships = userIdsToAdd
                    .Where(id => id != creatorId) // Skip creator as they're already added
                    .Select(userId => new CircleMembership
                    {
                        CircleId = circle.Id,
                        UserId = userId,
                        IsModerator = false
                    });

                await _dbContext.CircleMemberships.AddRangeAsync(memberships);
            }

            await _dbContext.SaveChangesAsync();
            await transaction.CommitAsync();

            // Send a notification to users that new subscribable circle is available
            if (circleDto.IsSubscribable)
            {
                IEnumerable<Guid> alreadyMembers = [];
                // Get distinct lists of frens vs users already added to the circle
                if (userIdsToAdd != null)
                {
                    alreadyMembers = userIdsToAdd.Where(id => id != creatorId);
                }
                // Really gotta reduce these N+1 queries on writes and put this into a background job...
                var allFrens = await _friendshipService.GetFriendsAsync(creatorId);
                var nonMembers = allFrens.Where(u => !alreadyMembers.Contains(u.Id)).Select(u => u.Id).ToArray();
                await _eventNotificationService.SendNewSubscribableCircle(authorId: creatorId,
                    authorName: creator.Name,
                    circleId: circle.Id,
                    circleName: circle.Name,
                    recipients: nonMembers,
                    alreadyMembers: alreadyMembers.ToArray());
            }

            return this._mapper.Map<CirclePublicDto>(entry.Entity);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "Error creating circle for user: {CreatorId}", creatorId);
            throw;
        }
    }

    public async Task<CirclePublicDto> GetCircleAsync(Guid requestorId, Guid circleId)
    {
        var circle = await _dbContext.Circles
            .Include(c => c.Owner)
            .Include(c => c.Members)
            .FirstOrDefaultAsync(c => c.Id == circleId);

        if (circle == null)
        {
            throw new BadHttpRequestException($"Circle {circleId} not found");
        }

        var requestorIsOwner = requestorId == circle.OwnerId;
        var requestorIsMemberOfShared = circle.IsShared && circle.Members.Any(m => m.UserId == requestorId);
        if (!requestorIsOwner && !requestorIsMemberOfShared)
        {
            throw new BadHttpRequestException($"User {requestorId} is not authorized to view circle {circleId}");
        }
        // TODO figure out how to include member UserDTOs in the response,
        return this._mapper.Map<CirclePublicDto>(circle);
    }

    public async Task<IEnumerable<CirclePublicDto>> GetUserOwnedCirclesAsync(Guid userId)
    {
        if (await this._dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId) == null)
        {
            throw new BadHttpRequestException($"Cannot create post for invalid user {userId}");
        }
        var circles = await _dbContext.Circles
            .Where(c => c.OwnerId == userId)
            .ToListAsync();
        return this._mapper.Map<IEnumerable<CirclePublicDto>>(circles);
    }

    // Get all circles where user is an owner or where they are a member of a shared circle. Do not include circles where user is a member of a private circle.
    public async Task<IEnumerable<CirclePublicDto>> GetUserMemberCirclesAsync(Guid userId)
    {
        if (await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId) == null)
        {
            throw new BadHttpRequestException($"Cannot create post for invalid user {userId}");
        }

        // Get circles where user is a member (through CircleMembership)
        var memberCircles = _dbContext.CircleMemberships
            .Where(cm => cm.UserId == userId)
            .Include(cm => cm.Circle)
            .Select(cm => cm.Circle)
            .Where(c => c != null && c.IsShared && c.OwnerId != userId); // Only include shared circles and ones the user does not own (to avoid duplicates, those get marked seperately)

        // Get circles where user is the owner
        var ownedCircles = _dbContext.Circles
            .Where(c => c.OwnerId == userId);

        var ownedCirclesMapped = _mapper.Map<IEnumerable<CirclePublicDto>>(ownedCircles).Select(c => new CirclePublicDto { Id = c.Id, IsOwner = true, IsShared = c.IsShared, Name = c.Name });
        // Combine both lists and remove duplicates
        // TODO: might  e bug if member circles returns 
        return _mapper.Map<IEnumerable<CirclePublicDto>>(memberCircles).Union(ownedCirclesMapped, new CircleIdComparer());
    }

    public async Task<IEnumerable<CircleWithMembersDto>> GetUserCirclesWithMembersAsync(Guid userId)
    {
        if (await this._dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId) == null)
        {
            throw new BadHttpRequestException($"Cannot get circles for invalid user {userId}");
        }

        // Get circles where user is a member (through CircleMembership)
        var memberCircles = await _dbContext.Circles
            .Where(c => c.Members.Any(m => m.UserId == userId) && c.IsShared && c.OwnerId != userId)
            .Include(c => c.Owner)
            .Include(c => c.Members)
                .ThenInclude(m => m.User)
            .ToListAsync();

        // Get circles where user is the owner
        var ownedCircles = await _dbContext.Circles
            .Where(c => c.OwnerId == userId)
            .Include(c => c.Members)
                .ThenInclude(m => m.User)
            .ToListAsync();

        var result = new List<CircleWithMembersDto>();

        // Map member circles
        foreach (var circle in memberCircles)
        {
            result.Add(new CircleWithMembersDto
            {
                Id = circle.Id,
                Name = circle.Name,
                IsShared = circle.IsShared,
                IsOwner = false,
                Owner = circle.Owner != null ? MapUserToDto(circle.Owner) : null,
                Members = circle.Members?.Select(m => MapUserToDto(m.User)).ToList() ?? new List<UserDto>()
            });
        }

        // Map owned circles
        foreach (var circle in ownedCircles)
        {
            result.Add(new CircleWithMembersDto
            {
                Id = circle.Id,
                Name = circle.Name,
                IsShared = circle.IsShared,
                IsOwner = true,
                Owner = null, // Current user is the owner, no need to show this
                Members = circle.Members?.Select(m => MapUserToDto(m.User)).ToList() ?? new List<UserDto>()
            });
        }

        return result;
    }
    
    private UserDto MapUserToDto(User? user)
    {
        if (user == null)
        {
            return new UserDto { Id = Guid.Empty, Name = "Unknown" };
        }
        return new UserDto
        {
            Id = user.Id,
            Name = user.Name,
            ProfilePictureUrl = !string.IsNullOrEmpty(user.ProfilePictureKey) 
                ? _storage.GetProfilePictureUrl(user.ProfilePictureKey) 
                : null
        };
    }

    public async Task DeleteCircleAsync(Guid requestorId, Guid circleId)
    {
        var circle = await _dbContext.Circles
            .Include(c => c.Members)
            .Include(c => c.Posts)
            .FirstOrDefaultAsync(c => c.Id == circleId);

        if (circle == null)
        {
            throw new BadHttpRequestException($"Circle {circleId} not found");
        }

        // Only the owner can delete the circle
        if (circle.OwnerId != requestorId)
        {
            throw new UnauthorizedAccessException($"User {requestorId} is not authorized to delete circle {circleId}");
        }

        // Start a transaction to ensure all operations succeed or fail together
        using var transaction = await _dbContext.Database.BeginTransactionAsync();
        try
        {
            // Remove all posts associated with this circle
            if (circle.Posts != null && circle.Posts.Any())
            {
                _dbContext.CirclePosts.RemoveRange(circle.Posts);
            }

            // Remove all memberships
            if (circle.Members != null && circle.Members.Any())
            {
                _dbContext.CircleMemberships.RemoveRange(circle.Members);
            }

            // Remove the circle itself
            _dbContext.Circles.Remove(circle);

            await _dbContext.SaveChangesAsync();
            await transaction.CommitAsync();

            _logger.LogInformation("Circle {CircleId} deleted by user {UserId}", circleId, requestorId);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "Error deleting circle {CircleId} for user: {UserId}", circleId, requestorId);
            throw;
        }
    }

    /// <summary>
    /// Allows a requestor, userId, to follow a fren's circle if it is subscribable
    /// </summary>
    /// <param name="userId">Requestor submitting follow</param>
    /// <param name="circleId">Circle to follow</param>
    /// <returns></returns>
    /// <exception cref="BadHttpRequestException"></exception>
    public async Task FollowCircle(Guid userId, Guid circleId, Guid? notificationId)
    {
        // Validate circle exists and is subscribable
        // Single query to get circle info, check ownership, and get existing members
        var circleInfo = await _dbContext.Circles
            .Where(c => c.Id == circleId && c.IsSubscribable)
            .Select(c => new
            {
                CircleId = c.Id,
                c.OwnerId,
                ExistingMemberIds = c.Members.Select(m => m.UserId).ToList()
            })
            .FirstOrDefaultAsync();
        if(circleInfo == null)
        {
            throw new BadHttpRequestException($"Subscribable circle {circleId} not found");
        }

        if (userId == circleInfo.OwnerId)
        {
            throw new BadHttpRequestException($"Circle owners cannot follow their own circle, they already have access!");
        }
        
        // Validate userId exists and is friends with circleId owner
        if (!await _friendshipService.AreFriendsAsync(userId, circleInfo.OwnerId))
        {
            throw new BadHttpRequestException($"User {userId} is not friends with circle owner, cannot subscribe");
        }

        // Validate user is not already a member of the circle
        if (circleInfo.ExistingMemberIds.Contains(userId))
        {
            throw new BadHttpRequestException($"User {userId} is already subscribed to circle {circleId}");
        }
        
        // Add user as CircleMember
        var membership = new CircleMembership
        {
            CircleId = circleId,
            UserId = userId,
            IsModerator = false
        };

        using var transaction = await _dbContext.Database.BeginTransactionAsync();
        await _dbContext.CircleMemberships.AddAsync(membership);

        if (notificationId != null)
        {
            var notif = await _dbContext.Notifications.Where(n => n.Id == notificationId).FirstOrDefaultAsync();
            if (notif != null)
            {
                _dbContext.Notifications.Remove(notif);
            }
        }
        await _dbContext.SaveChangesAsync();


        await transaction.CommitAsync();
        // TODO Send notification of new subscriber
    }

    public async Task DenyFollowCircle(Guid userId, Guid notificationId)
    {
        var notif = await _dbContext.Notifications.Where(n => n.Id == notificationId && n.UserId == userId).FirstOrDefaultAsync();
        if (notif == null)
        {
            // Yes this is the wrong http status...
            throw new BadHttpRequestException("Not found");
        }
        
        if (notif.Metadata == null || !notif.Metadata.Contains("NewSubscribableCircle"))
        {
            throw new BadHttpRequestException("Cannot unfollow on a notification that is not NewSubscribableCircle");
        }
        _dbContext.Notifications.Remove(notif);
        await _dbContext.SaveChangesAsync();
    }



    public async Task AddUsersToCircleAsync(Guid requestorId, Guid circleId, Guid[] userIdsToAdd)
    {
        if (userIdsToAdd == null || userIdsToAdd.Length == 0)
        {
            return; // Nothing to add
        }

        // Single query to get circle info, check ownership, and get existing members
        var circleInfo = await _dbContext.Circles
            .Where(c => c.Id == circleId)
            .Select(c => new
            {
                CircleId = c.Id,
                OwnerId = c.OwnerId,
                ExistingMemberIds = c.Members.Select(m => m.UserId).ToList()
            })
            .FirstOrDefaultAsync();

        if (circleInfo == null)
        {
            throw new BadHttpRequestException($"Circle {circleId} not found");
        }

        // Check if requestor is the owner
        if (circleInfo.OwnerId != requestorId)
        {
            throw new UnauthorizedAccessException($"User {requestorId} is not authorized to add users to circle {circleId}");
        }

        // Filter out users who are already members
        var newUserIds = userIdsToAdd.Where(id => !circleInfo.ExistingMemberIds.Contains(id)).ToArray();
        if (newUserIds.Length == 0)
        {
            return; // All users are already members
        }

        // Single query to validate friendships and user existence
        var friendshipAndUserValidation = await _dbContext.Users
            .Where(u => newUserIds.Contains(u.Id))
            .Select(u => new
            {
                UserId = u.Id,
                IsFriend = _dbContext.Friendships.Any(f => 
                    ((f.RequesterId == requestorId && f.AddresseeId == u.Id) ||
                     (f.RequesterId == u.Id && f.AddresseeId == requestorId)) &&
                    f.Status == FriendshipStatus.Accepted)
            })
            .ToListAsync();

        // Check if all users exist
        var existingUserIds = friendshipAndUserValidation.Select(v => v.UserId).ToList();
        var nonExistentUserIds = newUserIds.Where(id => !existingUserIds.Contains(id)).ToList();
        if (nonExistentUserIds.Any())
        {
            throw new BadHttpRequestException($"Cannot add non-existent users to circle: {string.Join(", ", nonExistentUserIds)}");
        }

        // Check if all users are friends with the requestor
        var nonFriendUserIds = friendshipAndUserValidation
            .Where(v => !v.IsFriend)
            .Select(v => v.UserId)
            .ToList();
        if (nonFriendUserIds.Any())
        {
            throw new BadHttpRequestException($"Cannot add non-friend users to circle: {string.Join(", ", nonFriendUserIds)}");
        }

        // Start transaction and add all validated users
        using var transaction = await _dbContext.Database.BeginTransactionAsync();
        try
        {
            var memberships = newUserIds.Select(userId => new CircleMembership
            {
                CircleId = circleId,
                UserId = userId,
                IsModerator = false
            });

            await _dbContext.CircleMemberships.AddRangeAsync(memberships);
            await _dbContext.SaveChangesAsync();
            await transaction.CommitAsync();

            _logger.LogInformation("Added {Count} users to circle {CircleId} by user {RequestorId}", 
                newUserIds.Length, circleId, requestorId);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "Error adding users to circle {CircleId} for user: {RequestorId}", circleId, requestorId);
            throw;
        }
    }

    /// <summary>
    /// Allows a requestor, userId, to unfollow a fren's circle if it is subscribable
    /// </summary>
    /// <param name="userId">Requestor submitting follow</param>
    /// <param name="circleId">Circle to follow</param>
    /// <returns></returns>
    /// <exception cref="BadHttpRequestException"></exception>
    public async Task UnfollowCircle(Guid userId, Guid circleId)
    {
        // Validate circle exists and is subscribable
        // Single query to get circle info, check ownership, and get existing members
        var circleInfo = await _dbContext.Circles
            .Where(c => c.Id == circleId && c.IsSubscribable)
            .Select(c => new
            {
                CircleId = c.Id,
                c.OwnerId,
                ExistingMemberIds = c.Members.Select(m => m.UserId).ToList()
            })
            .FirstOrDefaultAsync() 
            ?? throw new BadHttpRequestException($"Subscribable circle {circleId} not found");
        
        if (circleInfo.OwnerId == userId)
        {
            throw new BadHttpRequestException($"Circle owners cannot unfolllow their own circle!");
        }

        // Validate user is a member of the circle
        if (!circleInfo.ExistingMemberIds.Contains(userId))
        {
            throw new BadHttpRequestException($"User {userId} is not already subscribed to circle {circleId}");
        }

        using var transaction = _dbContext.Database.BeginTransaction();
        try
        {
            var membershipToRemove = _dbContext.CircleMemberships
                .Where(cm => cm.CircleId == circleId && cm.UserId == userId).FirstOrDefault() 
                ?? throw new BadHttpRequestException("Could not find existing membership");
            
            _dbContext.CircleMemberships.Remove(membershipToRemove);
            await _dbContext.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch (Exception ex)
        {
            transaction.Rollback();
            _logger.LogError(ex, "Error unfollowing circle {CircleId} for user: {UserId}", circleId, userId);
            throw;
        }
    }

    public Task RemoveUsersFromCircleAsync(Guid userId, Guid circleId, Guid[] userIds)
    {
        if (userIds == null || userIds.Length == 0)
        {
            return Task.CompletedTask; // Nothing to remove
        }

        // Single query to get circle info and check ownership
        var circleInfo = _dbContext.Circles
            .Where(c => c.Id == circleId)
            .Select(c => new
            {
                CircleId = c.Id,
                OwnerId = c.OwnerId,
                ExistingMemberIds = c.Members.Select(m => m.UserId).ToList()
            })
            .FirstOrDefault();

        if (circleInfo == null)
        {
            throw new BadHttpRequestException($"Circle {circleId} not found");
        }

        // Check if requestor is the owner
        if (circleInfo.OwnerId != userId)
        {
            throw new UnauthorizedAccessException($"User {userId} is not authorized to remove users from circle {circleId}");
        }

        // Filter out users who are not members
        var usersToRemove = userIds.Where(id => circleInfo.ExistingMemberIds.Contains(id)).ToArray();
        if (usersToRemove.Length == 0)
        {
            return Task.CompletedTask; // No valid users to remove
        }

        // Start transaction and remove all validated users
        using var transaction = _dbContext.Database.BeginTransaction();
        try
        {
            var membershipsToRemove = _dbContext.CircleMemberships
                .Where(cm => cm.CircleId == circleId && usersToRemove.Contains(cm.UserId));

            _dbContext.CircleMemberships.RemoveRange(membershipsToRemove);
            _dbContext.SaveChanges();
            transaction.Commit();

            _logger.LogInformation("Removed {Count} users from circle {CircleId} by user {UserId}", 
                usersToRemove.Length, circleId, userId);
        }
        catch (Exception ex)
        {
            transaction.Rollback();
            _logger.LogError(ex, "Error removing users from circle {CircleId} for user: {UserId}", circleId, userId);
            throw;
        }

        return Task.CompletedTask;
    }
}