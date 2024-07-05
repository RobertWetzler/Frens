namespace CliqBackend.Controllers;

using CliqBackend.Models;
// Service interface
public interface IPostService
{
    Task<Post> GetPostByIdAsync(string id);
    Task<IEnumerable<Post>> GetAllPostsAsync();
    Task<Post> CreatePostAsync(Post post);
    Task<Post> UpdatePostAsync(Post post);
    Task<bool> DeletePostAsync(string id);
}

// Service implementation
public class PostService : IPostService
{
    private readonly IPostRepository _repository;

    public PostService(IPostRepository repository)
    {
        _repository = repository;
    }

    public async Task<Post> GetPostByIdAsync(string id)
    {
        return await _repository.GetByIdAsync(id);
    }

    public async Task<IEnumerable<Post>> GetAllPostsAsync()
    {
        return await _repository.GetAllAsync();
    }

    public async Task<Post> CreatePostAsync(Post post)
    {
        post.Date = DateTime.UtcNow;
        return await _repository.CreateAsync(post);
    }

    public async Task<Post> UpdatePostAsync(Post post)
    {
        return await _repository.UpdateAsync(post);
    }

    public async Task<bool> DeletePostAsync(string id)
    {
        return await _repository.DeleteAsync(id);
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
        // Add some sample data
        _posts.Add(new Post
        {
            Id = "example",
            User = new User { Id = "user123", Name = "John Doe" },
            Date = DateTime.UtcNow,
            Type = "text",
            Content = new TextContent { Text = "This is an example post content." }
        });
    }

    public Task<Post> GetByIdAsync(string id)
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

    public Task<Post> UpdateAsync(Post post)
    {
        var existingPost = _posts.FirstOrDefault(p => p.Id == post.Id);
        if (existingPost != null)
        {
            existingPost.User = post.User;
            existingPost.Date = post.Date;
            existingPost.Type = post.Type;
            existingPost.Content = post.Content;
        }
        return Task.FromResult(existingPost);
    }

    public Task<bool> DeleteAsync(string id)
    {
        var post = _posts.FirstOrDefault(p => p.Id == id);
        if (post != null)
        {
            _posts.Remove(post);
            return Task.FromResult(true);
        }
        return Task.FromResult(false);
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