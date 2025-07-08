using AutoMapper;
using Cliq.Server.Data;
using Cliq.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace Cliq.Server.Services;

public interface ICircleService
{
    Task<CirclePublicDto> GetCircleAsync(Guid requestorId, Guid circleId);
    Task<CirclePublicDto> CreateCircleAsync(Guid creatorId, CircleCreationDto circleDto);
    Task<IEnumerable<CirclePublicDto>> GetUserOwnedCirclesAsync(Guid userId);
    Task<IEnumerable<CirclePublicDto>> GetUserMemberCirclesAsync(Guid userId);
    Task<IEnumerable<CircleWithMembersDto>> GetUserCirclesWithMembersAsync(Guid userId);
    Task DeleteCircleAsync(Guid requestorId, Guid circleId);
    Task AddUsersToCircleAsync(Guid requestorId, Guid circleId, Guid[] userIdsToAdd);
    Task RemoveUsersFromCircleAsync(Guid userId, Guid circleId, Guid[] userIds);
}

public class CircleService : ICircleService
{
    private readonly CliqDbContext _dbContext;
    private readonly ICommentService _commentService;
    private readonly IMapper _mapper;
    private readonly ILogger<CircleService> _logger;

    public CircleService(
        CliqDbContext dbContext,
        ICommentService commentService,
        IMapper mapper,
        ILogger<CircleService> logger)
    {
        _dbContext = dbContext;
        _commentService = commentService;
        _mapper = mapper;
        _logger = logger;
    }

    public async Task<CirclePublicDto> CreateCircleAsync(Guid creatorId, CircleCreationDto circleDto)
    {
        // TODO: Use a method from UserService for finding User by ID
        if (await this._dbContext.Users.FirstOrDefaultAsync(u => u.Id == creatorId) == null)
        {
            throw new BadHttpRequestException($"Cannot create post for invalid user {creatorId}");
        }

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

    public static async Task ValidateAuthorizationToPostAsync(CliqDbContext dbContext, Guid[] circleIds, Guid userId)
    {
        var circleValidation = await dbContext.Circles
        .Where(c => circleIds.Contains(c.Id))
        .Select(c => new
        {
            c.Id,
            IsUserMember = c.Members.Any(m => m.UserId == userId) || c.OwnerId == userId
        })
        .ToListAsync();

        // Check if any circles were not found
        var foundCircleIds = circleValidation.Select(c => c.Id).ToList();
        var missingCircleIds = circleIds.Except(foundCircleIds).ToList();
        if (missingCircleIds.Any())
        {
            throw new BadHttpRequestException(
                $"Cannot create post for invalid circle(s): {string.Join(", ", missingCircleIds)}");
        }

        // Check if user is not a member/owner of any of the circles
        var unauthorizedCircleIds = circleValidation
            .Where(c => !c.IsUserMember)
            .Select(c => c.Id)
            .ToList();
        if (unauthorizedCircleIds.Any())
        {
            throw new UnauthorizedAccessException(
                $"User is not a member of circle(s): {string.Join(", ", unauthorizedCircleIds)}");
        }
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
                Owner = circle.Owner != null ? new UserDto { Id = circle.Owner.Id, Name = circle.Owner.Name } : null,
                Members = circle.Members?.Select(m => new UserDto { Id = m.User?.Id ?? Guid.Empty, Name = m.User?.Name ?? "Unknown" }).ToList() ?? new List<UserDto>()
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
                Members = circle.Members?.Select(m => new UserDto { Id = m.User?.Id ?? Guid.Empty, Name = m.User?.Name ?? "Unknown" }).ToList() ?? new List<UserDto>()
            });
        }

        return result;
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