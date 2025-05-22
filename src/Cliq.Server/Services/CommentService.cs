using AutoMapper;
using Cliq.Server.Data;
using Cliq.Server.Models;
using Cliq.Server.Services;
using Microsoft.EntityFrameworkCore;
using Npgsql;

public interface ICommentService
{
    public Task<CommentDto> CreateCommentAsync(string text, Guid userId, Guid postId, Guid? parentCommentId = null);
    public Task<IEnumerable<CommentDto>> GetAllCommentsForPostAsync(Guid postId);
    public Task<bool> DeleteCommentAsync(Guid commentId, Guid userId);
}
public class CommentService : ICommentService
{
    private readonly CliqDbContext _dbContext;
    private readonly IMapper _mapper;

    public CommentService(CliqDbContext dbContext, IMapper mapper)
    {
        _dbContext = dbContext;
        _mapper = mapper;
    }

    public async Task<CommentDto> CreateCommentAsync(string text, Guid userId, Guid postId, Guid? parentCommentId = null)
    {
        if (parentCommentId != null)
        {
            // Verify parent comment exists and belongs to the same post
            var parentComment = await _dbContext.Comments
                .FirstOrDefaultAsync(c => c.Id == parentCommentId && c.PostId == postId);

            if (parentComment == null)
                throw new ArgumentException("Parent comment not found or doesn't belong to specified post");
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

        try
        {
            await _dbContext.Comments.AddAsync(comment);
            await _dbContext.SaveChangesAsync();
            // Fetch the newly created comment with User data included
            var commentWithUser = await _dbContext.Comments
                .Include(c => c.User)
                .FirstAsync(c => c.Id == comment.Id);

            return _mapper.Map<CommentDto>(commentWithUser);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException pgEx &&
                                         pgEx.SqlState == PostgresErrorCodes.ForeignKeyViolation)
        {
            throw new ArgumentException("Parent post not found");
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
            .Include(c => c.User)
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
