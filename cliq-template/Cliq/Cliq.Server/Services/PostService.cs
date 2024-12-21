using AutoMapper;
using Cliq.Server.Data;
using Cliq.Server.Models;
using Cliq.Server.Utilities;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Server.IIS;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.Extensions.Hosting;

namespace Cliq.Server.Services;

public interface IPostService
{
    Task<PostDto?> GetPostByIdAsync(string id, bool includeCommentTree = false, int maxDepth = 3);
    Task<IEnumerable<PostDto>> GetFeedForUserAsync(string userId, int page = 1, int pageSize = 20);
    Task<List<PostDto>> GetAllPostsAsync(bool includeCommentCount = false);
    Task<IEnumerable<PostDto>> GetUserPostsAsync(string userId, int page = 1, int pageSize = 20);
    Task<PostDto> CreatePostAsync(string userId, string text);
    Task<PostDto?> UpdatePostAsync(string id, string newText);
    Task<bool> DeletePostAsync(string id);
    Task<bool> AddViewerAsync(string postId, string userId);
    Task<bool> RemoveViewerAsync(string postId, string userId);
    Task<bool> PostExistsAsync(string id);
    Task<int> SaveChangesAsync();
}

// Service implementation
public class PostService : IPostService
{
    private readonly CliqDbContext _dbContext;
    private readonly ICommentService _commentService;
    private readonly IMapper _mapper;
    private readonly ILogger<PostService> _logger;

    public PostService(
        CliqDbContext dbContext,
        ICommentService commentService,
        IMapper mapper,
        ILogger<PostService> logger)
    {
        _dbContext = dbContext;
        _commentService = commentService;
        _mapper = mapper;
        _logger = logger;
    }

    public async Task<PostDto?> GetPostByIdAsync(string id, bool includeCommentTree = true, int maxDepth = 3)
    {
        var post = await _dbContext.Posts
            .Include(p => p.User)
            .Include(p => p.Viewers)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (post == null) return null;

        var dto = this._mapper.Map<PostDto>(post);
        if (includeCommentTree)
        {
            dto.Comments = (await _commentService.GetAllCommentsForPostAsync(id)).ToList();
        }

        return dto;
    }


    public async Task<IEnumerable<PostDto>> GetFeedForUserAsync(string userId, int page = 1, int pageSize = 20)
    {
        try
        {
            var posts =  await _dbContext.Posts
                .Include(p => p.User)
                .Include(p => p.Viewers)
                .Where(p => p.UserId == userId || p.Viewers.Any(v => v.Id == userId))
                .OrderByDescending(p => p.Date)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
            return this._mapper.Map<PostDto[]>(posts);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving feed for user: {UserId}", userId);
            throw;
        }
    }

    public async Task<List<PostDto>> GetAllPostsAsync(bool includeCommentCount = false)
    {
        if (includeCommentCount)
        {
            // Single query approach using group join
            var result = await(
                from p in _dbContext.Posts
                    .Include(p => p.User)
                    .OrderByDescending(p => p.Date)
                join c in _dbContext.Comments
                    on p.Id equals c.PostId into comments
                select new
                {
                    Post = p,
                    CommentCount = comments.Count()
                })
                .AsNoTracking()
                .ToListAsync();

            return result.Select(pc =>
            {
                var dto = _mapper.Map<PostDto>(pc.Post);
                dto.CommentCount = pc.CommentCount;
                return dto;
            }).ToList();
        }
        else
        {
            var posts = await _dbContext.Posts
                .Include(p => p.User)
                .OrderByDescending(p => p.Date)
                .AsNoTracking()
                .ToListAsync();

            return _mapper.Map<List<PostDto>>(posts);
        }
    }
    public async Task<IEnumerable<PostDto>> GetUserPostsAsync(string userId, int page = 1, int pageSize = 20)
    {
        try
        {
            var posts =  await _dbContext.Posts
                .Include(p => p.User)
                .Include(p => p.Viewers)
                .Where(p => p.UserId == userId)
                .OrderByDescending(p => p.Date)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
            return this._mapper.Map<PostDto[]>(posts);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving posts for user: {UserId}", userId);
            throw;
        }
    }

    // TODO: Should FromBody be used to force JSON body request (POST semantic)?
    // TODO: Take userId from JWT token
    public async Task<PostDto> CreatePostAsync([FromBody] string userId, [FromBody] string text)
    {
        // TODO: Use a method from UserService for finding User by ID
        if (await this._dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId) == null)
        {
            throw new Microsoft.AspNetCore.Http.BadHttpRequestException($"Cannot create post for invalid user {userId}");
        }

        try
        {
            var post = new Post
            {
                Id = Guid.NewGuid().ToString(),
                UserId = userId,
                Text = text,
                Date = DateTime.UtcNow
            };

            var entry = await _dbContext.Posts.AddAsync(post);
            await SaveChangesAsync();

            // Reload the post with relationships
            await _dbContext.Entry(post)
                .Reference(p => p.User)
                .LoadAsync();

            await _dbContext.Entry(post)
                .Collection(p => p.Viewers)
                .LoadAsync();

            return this._mapper.Map<PostDto>(entry.Entity);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating post for user: {UserId}", userId);
            throw;
        }
    }

    public async Task<PostDto?> UpdatePostAsync(string id, string newText)
    {
        try
        {
            var post = await this._dbContext.Posts
                        .FirstOrDefaultAsync(p => p.Id == id);
            if (post == null) return null;

            post.Text = newText;
            _dbContext.Posts.Update(post);
            await SaveChangesAsync();

            return this._mapper.Map<PostDto>(post);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating post: {PostId}", id);
            throw;
        }
    }

    public async Task<bool> DeletePostAsync(string id)
    {
        try
        {
            var post = await _dbContext.Posts.FindAsync(id);
            if (post == null) return false;

            _dbContext.Posts.Remove(post);
            await SaveChangesAsync();
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting post: {PostId}", id);
            throw;
        }
    }

    public async Task<bool> AddViewerAsync(string postId, string userId)
    {
        try
        {
            var post = await _dbContext.Posts
                .Include(p => p.Viewers)
                .FirstOrDefaultAsync(p => p.Id == postId);

            if (post == null) return false;

            var user = await _dbContext.Users.FindAsync(userId);
            if (user == null) return false;

            if (!post.Viewers.Any(v => v.Id == userId))
            {
                post.Viewers.Add(user);
                await SaveChangesAsync();
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding viewer {UserId} to post {PostId}", userId, postId);
            throw;
        }
    }

    public async Task<bool> RemoveViewerAsync(string postId, string userId)
    {
        try
        {
            var post = await _dbContext.Posts
                .Include(p => p.Viewers)
                .FirstOrDefaultAsync(p => p.Id == postId);

            if (post == null) return false;

            var viewer = post.Viewers.FirstOrDefault(v => v.Id == userId);
            if (viewer == null) return false;

            post.Viewers.Remove(viewer);
            await SaveChangesAsync();
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing viewer {UserId} from post {PostId}", userId, postId);
            throw;
        }
    }

    public async Task<bool> PostExistsAsync(string id)
    {
        return await _dbContext.Posts.AnyAsync(p => p.Id == id);
    }

    public async Task<int> SaveChangesAsync()
    {
        return await _dbContext.SaveChangesAsync();
    }
}

// Extension method for dependency injection
public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddPostServices(this IServiceCollection services)
    {
        services.AddScoped<IPostService, PostService>();
        return services;
    }
}
