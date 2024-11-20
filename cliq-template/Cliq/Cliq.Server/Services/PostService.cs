using Cliq.Server.Data;
using Cliq.Server.Models;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace Cliq.Server.Services;

public interface IPostService
{
    Task<Post?> GetPostByIdAsync(string id);
    Task<IEnumerable<Post>> GetFeedForUserAsync(string userId, int page = 1, int pageSize = 20);
    Task<IEnumerable<Post>> GetAllPostsAsync();
    Task<IEnumerable<Post>> GetUserPostsAsync(string userId, int page = 1, int pageSize = 20);
    Task<Post> CreatePostAsync(Post post);
    Task<Post?> UpdatePostAsync(string id, string newText);
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
    private readonly ILogger<PostService> _logger;

    public PostService(
        CliqDbContext dbContext,
        ILogger<PostService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<Post?> GetPostByIdAsync(string id)
    {
        try
        {
            return await _dbContext.Posts
                .Include(p => p.User)
                .Include(p => p.Viewers)
                .FirstOrDefaultAsync(p => p.Id == id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving post with ID: {PostId}", id);
            throw;
        }
    }

    public async Task<IEnumerable<Post>> GetFeedForUserAsync(string userId, int page = 1, int pageSize = 20)
    {
        try
        {
            return await _dbContext.Posts
                .Include(p => p.User)
                .Include(p => p.Viewers)
                .Where(p => p.UserId == userId || p.Viewers.Any(v => v.Id == userId))
                .OrderByDescending(p => p.Date)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving feed for user: {UserId}", userId);
            throw;
        }
    }

    public async Task<IEnumerable<Post>> GetAllPostsAsync()
    {
        try
        {
            return await _dbContext.Posts
                .Include(p => p.User)
                .Include(p => p.Viewers)
                .ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving all posts");
            throw;
        }
    }
    public async Task<IEnumerable<Post>> GetUserPostsAsync(string userId, int page = 1, int pageSize = 20)
    {
        try
        {
            return await _dbContext.Posts
                .Include(p => p.User)
                .Include(p => p.Viewers)
                .Where(p => p.UserId == userId)
                .OrderByDescending(p => p.Date)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving posts for user: {UserId}", userId);
            throw;
        }
    }

    public async Task<Post> CreatePostAsync(Post post)
    {
        if (post == null)
            throw new ArgumentNullException(nameof(post));

        try
        {
            // Ensure Id is set if not provided
            if (string.IsNullOrEmpty(post.Id))
            {
                post.Id = Guid.NewGuid().ToString();
            }

            // Ensure date is set
            if (post.Date == default)
            {
                post.Date = DateTime.UtcNow;
            }

            var entry = await _dbContext.Posts.AddAsync(post);
            await SaveChangesAsync();

            // Reload the post with relationships
            await _dbContext.Entry(post)
                .Reference(p => p.User)
                .LoadAsync();

            await _dbContext.Entry(post)
                .Collection(p => p.Viewers)
                .LoadAsync();

            return entry.Entity;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating post for user: {UserId}", post.UserId);
            throw;
        }
    }

    public async Task<Post?> UpdatePostAsync(string id, string newText)
    {
        try
        {
            var post = await GetPostByIdAsync(id);
            if (post == null) return null;

            post.Text = newText;
            _dbContext.Posts.Update(post);
            await SaveChangesAsync();

            return post;
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

    // Repository interface
    public interface IPostRepository
{
    Task<Post> GetByIdAsync(string id);
    Task<IEnumerable<Post>> GetAllAsync();
    Task<Post> CreateAsync(Post post);
    Task<Post> UpdateAsync(Post post);
    Task<bool> DeleteAsync(string id);
}

// In-memory repository implementation
public class InMemoryPostRepository : IPostRepository
{
    private readonly List<Post> _posts = new List<Post>();

    public InMemoryPostRepository()
    {
        var user = new User { Id = "user123", Name = "Robert Wetzler", Email = "rwetzler779@gmail.com", Username = "RobAdmin", Password = "Stripse10"  };
        // Add some sample data
        this._posts.Add(new Post
        {
            Id = "postId12345678",
            UserId = user.Id,
            User = user,
            Date = DateTime.UtcNow,
            Text = "This is awesome"
        });
    }

    public Task<Post?> GetByIdAsync(string id)
    {
        return Task.FromResult(_posts.FirstOrDefault(p => p.Id == id));
    }

    public Task<IEnumerable<Post>> GetAllAsync()
    {
        return Task.FromResult(_posts.AsEnumerable());
    }

    public Task<Post> CreateAsync(Post post)
    {
        post.Id = Guid.NewGuid().ToString();
        _posts.Add(post);
        return Task.FromResult(post);
    }

    public async Task<Post?> UpdateAsync(Post post)
    {
        var existingPost = await this.GetByIdAsync(post.Id);
        if (existingPost != null)
        {
            existingPost.User = post.User;
            existingPost.Date = post.Date;
            existingPost.Text = post.Text;
            existingPost.Viewers = post.Viewers;
        }
        return existingPost;
    }

    public async Task<bool> DeleteAsync(string id)
    {
        var post = await this.GetByIdAsync(id);
        if (post != null)
        {
            _posts.Remove(post);
            return true;
        }
        return false;
    }
}

// Extension method for dependency injection
public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddPostServices(this IServiceCollection services)
    {
        services.AddScoped<IPostRepository, InMemoryPostRepository>();
        services.AddScoped<IPostService, PostService>();
        return services;
    }
}
