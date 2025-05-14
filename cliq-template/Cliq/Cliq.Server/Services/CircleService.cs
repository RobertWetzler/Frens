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

            return this._mapper.Map<CirclePublicDto>(entry.Entity);
        }
        catch (Exception ex)
        {
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

        var requestorIsOwner = requestorId != circle.OwnerId;
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
    var memberCircles = await _dbContext.CircleMemberships
        .Where(cm => cm.UserId == userId)
        .Include(cm => cm.Circle)
        .Select(cm => cm.Circle)
        .Where(c => c.IsShared) // Only include shared circles
        .ToListAsync();
    
    // Get circles where user is the owner
    var ownedCircles = await _dbContext.Circles
        .Where(c => c.OwnerId == userId)
        .ToListAsync();
    
    // Combine both lists and remove duplicates
    var allCircles = memberCircles
        .Union(ownedCircles, new CircleIdComparer())
        .ToList();
    
    return _mapper.Map<IEnumerable<CirclePublicDto>>(allCircles);
}
}