using AutoMapper;
using Cliq.Server.Data;
using Cliq.Server.Models;
using Cliq.Server.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Npgsql;

public interface ICommentService
{
    /// <summary>
    /// Unified comment creation method - handles all comment types via polymorphic request objects.
    /// </summary>
    Task<CommentDto> CreateCommentAsync(CreateCommentRequest request);
    Task<IEnumerable<CommentDto>> GetAllCommentsForPostAsync(Guid postId);
    Task<bool> DeleteCommentAsync(Guid commentId, Guid userId);
    // Toggle seat in carpool: if not joined, attempt to join; if already joined, leave. Returns true on join, false on leave.
    Task<bool> ToggleCarpoolSeatAsync(Guid commentId, Guid userId, string username);
}
public class CommentService : ICommentService
{
    private readonly CliqDbContext _dbContext;
    private readonly IMapper _mapper;
    private readonly IEventNotificationService _eventNotificationService;
    private readonly ILogger _logger;
    private readonly IUserActivityService _activityService;
    private readonly IObjectStorageService _storage;

    public CommentService(CliqDbContext dbContext,
        IMapper mapper,
        IEventNotificationService eventNotificationService,
        ILogger<PostService> logger,
        IUserActivityService activityService,
        IObjectStorageService storage
        )
    {
        _dbContext = dbContext;
        _mapper = mapper;
        _eventNotificationService = eventNotificationService;
        _logger = logger;
        _activityService = activityService;
        _storage = storage;
    }

    /// <summary>
    /// Unified comment creation - all comment types go through this single code path.
    /// Type-specific behavior is handled via the polymorphic request object.
    /// </summary>
    public async Task<CommentDto> CreateCommentAsync(CreateCommentRequest request)
    {
        // 1. Validate parent post exists
        var parentPost = await _dbContext.Posts
            .FirstOrDefaultAsync(p => p.Id == request.PostId)
            ?? throw new ArgumentException("Parent post not found");

        // 2. Validate parent comment if this is a reply
        Comment? parentComment = null;
        if (request.ParentCommentId.HasValue)
        {
            parentComment = await _dbContext.Comments
                .Include(c => c.User) // Include User data for notifications
                .FirstOrDefaultAsync(c => c.Id == request.ParentCommentId && c.PostId == request.PostId)
                ?? throw new ArgumentException("Parent comment not found or doesn't belong to specified post");
        }

        // 3. Build the comment entity
        var comment = new Comment
        {
            Id = Guid.NewGuid(),
            Text = request.Text,
            UserId = request.UserId,
            PostId = request.PostId,
            ParentCommentId = request.ParentCommentId,
            Date = DateTime.UtcNow
        };

        // 4. Apply type-specific properties (carpool spots, etc.)
        request.ApplyTo(comment);

        // 5. Persist the comment
        CommentDto result;
        Comment commentWithUser;
        try
        {
            await _dbContext.Comments.AddAsync(comment);
            await _dbContext.SaveChangesAsync();

            // Fetch with all related data for mapping
            commentWithUser = await _dbContext.Comments
                .Include(c => c.User).ThenInclude(u => u.DiscoveredEasterEggs)
                .Include(c => c.CarpoolSeats).ThenInclude(s => s.User)
                .FirstAsync(c => c.Id == comment.Id);

            result = MapCommentToDto(commentWithUser);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException pgEx &&
                                         pgEx.SqlState == PostgresErrorCodes.ForeignKeyViolation)
        {
            throw new ArgumentException("Parent post not found");
        }

        // 6. Send notifications (all comment types get notifications)
        await SendCommentNotificationsAsync(comment, commentWithUser, parentPost, parentComment);

        // 7. Record user activity for DAU/WAU/MAU tracking (fire-and-forget)
        _ = Task.Run(async () => await _activityService.RecordActivityAsync(request.UserId, UserActivityType.CommentCreated));

        return result;
    }

    /// <summary>
    /// Handles all notification logic for comment creation.
    /// Extracted to keep the main creation method clean.
    /// </summary>
    private async Task SendCommentNotificationsAsync(
        Comment comment,
        Comment commentWithUser,
        Post parentPost,
        Comment? parentComment)
    {
        try
        {
            // Notify post author (if not commenting on own post)
            if (parentPost.UserId != comment.UserId && commentWithUser.User != null)
            {
                await _eventNotificationService.SendNewCommentNotificationAsync(
                    commentId: comment.Id,
                    postId: comment.PostId,
                    postAuthorId: parentPost.UserId,
                    commenterId: comment.UserId,
                    commentText: comment.Text,
                    commenterName: commentWithUser.User.Name);
            }
            // TODO Dont notify post author if they are also the parent comment author
            // Notify parent comment author if this is a reply (and not replying to own comment)
            if (parentComment?.User != null && parentComment.User.Id != comment.UserId)
            {
                await _eventNotificationService.SendCommentReplyNotificationAsync(
                    replyId: comment.Id,
                    postId: comment.PostId,
                    parentCommentId: parentComment.Id,
                    parentCommentAuthorId: parentComment.User.Id,
                    replierId: comment.UserId,
                    replyText: comment.Text,
                    commenterName: commentWithUser.User!.Name);
            }
        }
        catch (Exception ex)
        {
            // Log error but don't fail the comment creation
            _logger.LogWarning(ex, "Failed to send notifications for comment {CommentId}", comment.Id);
        }
    }

    // New method to efficiently get comment count for posts
    public async Task<Dictionary<Guid, int>> GetCommentCountsForPostsAsync(IEnumerable<Guid> postIds)
    {
        return await _dbContext.Comments
            .Where(c => postIds.Contains(c.PostId))
            .GroupBy(c => c.PostId)
            .ToDictionaryAsync(
                g => g.Key,
                g => g.Count()
            );
    }

    // TODO: A potential optimization to provide pagination/depth control is to use a closure table
    // See https://stackoverflow.com/a/11565855
    public async Task<IEnumerable<CommentDto>> GetAllCommentsForPostAsync(Guid postId)
    {
        // Get all comments for this post in a single query
        var allComments = await _dbContext.Comments
            .Where(c => c.PostId == postId)
            //.Where(c => c.ParentCommentId == null) // root comments
            .Include(c => c.User).ThenInclude(u => u.DiscoveredEasterEggs)
            .Include(c => c.CarpoolSeats).ThenInclude(s => s.User)
            .OrderByDescending(c => c.Date)
            .ToListAsync();

        // Build comment hierarchy in memory
        var commentDict = allComments.ToDictionary(c => c.Id);
        //var rootComments = new List<Comment>();
        var rootComments = allComments.Where(c => c.ParentCommentId == null);

        var rootCommentsDto = rootComments.Select(MapCommentTree);

        return rootCommentsDto;
    }

    /// <summary>
    /// Maps a comment entity to the appropriate polymorphic DTO type
    /// </summary>
    private CommentDto MapCommentToDto(Comment comment)
    {
        var dto = comment.Type switch
        {
            CommentType.Carpool => _mapper.Map<CarpoolCommentDto>(comment),
            _ => _mapper.Map<CommentDto>(comment)
        };
        
        // Populate profile picture URL for comment author
        if (dto.User != null && comment.User != null && !string.IsNullOrEmpty(comment.User.ProfilePictureKey))
        {
            dto.User.ProfilePictureUrl = _storage.GetProfilePictureUrl(comment.User.ProfilePictureKey);
        }
        
        // For carpool comments, also populate profile pictures for riders
        if (dto is CarpoolCommentDto carpoolDto && comment.CarpoolSeats != null)
        {
            foreach (var rider in carpoolDto.CarpoolRiders)
            {
                var seat = comment.CarpoolSeats.FirstOrDefault(s => s.UserId == rider.Id);
                if (seat?.User != null && !string.IsNullOrEmpty(seat.User.ProfilePictureKey))
                {
                    rider.ProfilePictureUrl = _storage.GetProfilePictureUrl(seat.User.ProfilePictureKey);
                }
            }
        }
        
        return dto;
    }

    /// <summary>
    /// This method recursively maps a comment and all of its replies to a DTO
    /// </summary>
    private CommentDto MapCommentTree(Comment comment)
    {
        var dto = MapCommentToDto(comment);
        if (comment.Replies != null)
        {
            dto.Replies = comment.Replies
                .OrderByDescending(r => r.Date)  // Ensure replies are ordered
                .Select(MapCommentTree)
                .ToList();
        }
        return dto;
    }


    public async Task<bool> DeleteCommentAsync(Guid commentId, Guid userId)
    {
        var comment = await _dbContext.Comments
            .FirstOrDefaultAsync(c => c.Id == commentId && c.UserId == userId);

        if (comment == null) return false;

        _dbContext.Comments.Remove(comment);
        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ToggleCarpoolSeatAsync(Guid commentId, Guid userId, string username)
    {
        // Find the carpool comment
        var comment = await _dbContext.Comments
            .Include(c => c.CarpoolSeats)
            .FirstOrDefaultAsync(c => c.Id == commentId);

        if (comment == null) throw new ArgumentException("Comment not found");
        if (comment.Type != CommentType.Carpool) throw new ArgumentException("Comment is not a carpool announcement");

        var existingSeat = comment.CarpoolSeats.FirstOrDefault(s => s.UserId == userId);
        bool isOptIn = existingSeat == null;

        if (isOptIn)
        {
            // Check capacity if set
            if (comment.CarpoolSpots.HasValue)
            {
                var taken = comment.CarpoolSeats.Count;
                if (taken >= comment.CarpoolSpots.Value)
                {
                    throw new InvalidOperationException("No available carpool spots");
                }
            }

            var seat = new CarpoolSeat
            {
                Id = Guid.NewGuid(),
                CommentId = commentId,
                UserId = userId,
                ReservedAt = DateTime.UtcNow
            };
            await _dbContext.CarpoolSeats.AddAsync(seat);
            await _dbContext.SaveChangesAsync();
        }
        else
        {
            // Leave: remove seat
#pragma warning disable CS8604 // Possible null reference argument.
            _dbContext.CarpoolSeats.Remove(existingSeat);
#pragma warning restore CS8604 // Possible null reference argument.
            await _dbContext.SaveChangesAsync();
            return false; // indicates leave
        }
        await _eventNotificationService.SendCarpoolReplyNotificationAsync(
            postId: comment.PostId,
            commentId: comment.Id,
            commentAuthorId: comment.UserId,
            commentText: comment.Text,
            carpoolerId: userId,
            carpoolerName: username.IsNullOrEmpty() ? (await _dbContext.Users.FindAsync(userId))?.Name ?? "Someone" : username,
            isOptIn: isOptIn);
        return isOptIn; // indicates join
    }
}
// Extension method for dependency injection
public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddCommentServices(this IServiceCollection services)
    {
        services.AddScoped<ICommentService, CommentService>();
        return services;
    }
}
