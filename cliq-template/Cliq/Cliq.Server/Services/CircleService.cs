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
            .Where(c => c.IsShared && c.OwnerId != userId); // Only include shared circles and ones the user does not own (to avoid duplicates, those get marked seperately)

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
}