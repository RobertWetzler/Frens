using AutoMapper;
using Cliq.Server.Data;
using Cliq.Server.Models;
using Cliq.Server.Services;
using Microsoft.EntityFrameworkCore;
using Npgsql;

public interface ICommentService
{
    public Task<CommentDto> CreateCommentAsync(string text, Guid userId, Guid postId, Guid? parentCommentId = null);
    public Task<CommentDto> CreateCarpoolCommentAsync(string text, Guid userId, Guid postId, int spots, Guid? parentCommentId = null);
    public Task<IEnumerable<CommentDto>> GetAllCommentsForPostAsync(Guid postId);
    public Task<bool> DeleteCommentAsync(Guid commentId, Guid userId);
    // Toggle seat in carpool: if not joined, attempt to join; if already joined, leave. Returns true on join, false on leave.
    public Task<bool> ToggleCarpoolSeatAsync(Guid commentId, Guid userId);
}
public class CommentService : ICommentService
{
    private readonly CliqDbContext _dbContext;
    private readonly IMapper _mapper;
    private readonly IEventNotificationService _eventNotificationService;
    private readonly ILogger _logger;
    private readonly IUserActivityService _activityService;

    public CommentService(CliqDbContext dbContext,
        IMapper mapper,
        IEventNotificationService eventNotificationService,
        ILogger<PostService> logger,
        IUserActivityService activityService
        )
    {
        _dbContext = dbContext;
        _mapper = mapper;
        _eventNotificationService = eventNotificationService;
        _logger = logger;
        _activityService = activityService;
    }

    public async Task<CommentDto> CreateCommentAsync(string text, Guid userId, Guid postId, Guid? parentCommentId = null)
    {
        var parentPost = await _dbContext.Posts
            .FirstOrDefaultAsync(p => p.Id == postId);
        if (parentPost == null)
            throw new ArgumentException("Parent post not found");

        Comment? parentComment = null;
        if (parentCommentId.HasValue)
        {
            // Verify parent comment exists and belongs to the same post
            parentComment = await _dbContext.Comments
                .Include(c => c.User) // Include User data for notifications
                .FirstOrDefaultAsync(c => c.Id == parentCommentId && c.PostId == postId)
                ?? throw new ArgumentException("Parent comment not found or doesn't belong to specified post");
        }

        var comment = new Comment
        {
            Id = Guid.NewGuid(),
            Text = text,
            UserId = userId,
            PostId = postId,
            ParentCommentId = parentCommentId,
            Date = DateTime.UtcNow
        };

        CommentDto result;
        Comment commentWithUser;
        try
        {
            await _dbContext.Comments.AddAsync(comment);
            await _dbContext.SaveChangesAsync();
            // Fetch the newly created comment with User data included
            commentWithUser = await _dbContext.Comments
                .Include(c => c.User)
                .FirstAsync(c => c.Id == comment.Id);

            result = _mapper.Map<CommentDto>(commentWithUser);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException pgEx &&
                                         pgEx.SqlState == PostgresErrorCodes.ForeignKeyViolation)
        {
            throw new ArgumentException("Parent post not found");
        }

        // Send notification of comment
        try
        {
            // To post author
            if (parentPost.UserId != userId && commentWithUser.User != null)
            {
                await _eventNotificationService.SendNewCommentNotificationAsync(
                    commentId: comment.Id,
                    postId: postId,
                    postAuthorId: parentPost.UserId,
                    commenterId: userId,
                    commentText: text,
                    commenterName: commentWithUser.User!.Name);
            }

            // To parent comment author (if applicable)
            if (parentComment != null && parentComment.User != null && parentComment.User.Id != userId) // Don't notify if replying to own comment
            {
                await _eventNotificationService.SendCommentReplyNotificationAsync(
                    replyId: commentWithUser.Id,
                    postId: postId,
                    parentCommentId: parentCommentId!.Value,
                    parentCommentAuthorId: parentComment.User.Id,
                    replierId: userId,
                    replyText: text,
                    commenterName: commentWithUser.User!.Name);
            }
        }
        catch (Exception ex)
        {
            // Log error but don't fail the post creation
            _logger.LogWarning(ex, "Failed to send post notifications for comment {CommentId}", comment.Id);
        }

        // Record user activity for DAU/WAU/MAU tracking (fire-and-forget)
        _ = Task.Run(async () => await _activityService.RecordActivityAsync(userId, UserActivityType.CommentCreated));

        return result;
    }

    public async Task<CommentDto> CreateCarpoolCommentAsync(string text, Guid userId, Guid postId, int spots, Guid? parentCommentId = null)
    {
        var parentPost = await _dbContext.Posts
            .FirstOrDefaultAsync(p => p.Id == postId);
        if (parentPost == null)
            throw new ArgumentException("Parent post not found");

        // Validate parent comment if provided
        if (parentCommentId.HasValue)
        {
            var parentComment = await _dbContext.Comments
                .FirstOrDefaultAsync(c => c.Id == parentCommentId && c.PostId == postId)
                ?? throw new ArgumentException("Parent comment not found or doesn't belong to specified post");
        }

        var comment = new Comment
        {
            Id = Guid.NewGuid(),
            Text = text,
            UserId = userId,
            PostId = postId,
            ParentCommentId = parentCommentId,
            Date = DateTime.UtcNow,
            Type = CommentType.Carpool,
            CarpoolSpots = spots
        };

        await _dbContext.Comments.AddAsync(comment);
        await _dbContext.SaveChangesAsync();

        var commentWithUser = await _dbContext.Comments
            .Include(c => c.User)
            .Include(c => c.CarpoolSeats).ThenInclude(s => s.User)
            .FirstAsync(c => c.Id == comment.Id);

        var result = _mapper.Map<CommentDto>(commentWithUser);

        // record activity
        _ = Task.Run(async () => await _activityService.RecordActivityAsync(userId, UserActivityType.CommentCreated));

        return result;
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
            .Include(c => c.User)
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
    /// This method recursively maps a comment and all of its replies to a DTO
    /// </summary>
    /// <param name="comment"></param>
    /// <returns></returns>
    private CommentDto MapCommentTree(Comment comment)
    {
        var dto = _mapper.Map<CommentDto>(comment);
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

    public async Task<bool> ToggleCarpoolSeatAsync(Guid commentId, Guid userId)
    {
        // Find the carpool comment
        var comment = await _dbContext.Comments
            .Include(c => c.CarpoolSeats)
            .FirstOrDefaultAsync(c => c.Id == commentId);

        if (comment == null) throw new ArgumentException("Comment not found");
        if (comment.Type != CommentType.Carpool) throw new ArgumentException("Comment is not a carpool announcement");

        var existingSeat = comment.CarpoolSeats.FirstOrDefault(s => s.UserId == userId);
        if (existingSeat != null)
        {
            // Leave: remove seat
            _dbContext.CarpoolSeats.Remove(existingSeat);
            await _dbContext.SaveChangesAsync();
            return false; // indicates leave
        }

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

        return true; // indicates join
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
