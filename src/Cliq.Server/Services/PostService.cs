using AutoMapper;
using Cliq.Server.Data;
using Cliq.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace Cliq.Server.Services;

public interface IPostService
{
    Task<PostDto?> GetPostByIdAsync(Guid requestorId, Guid id, bool includeCommentTree = false, int maxDepth = 3);
    Task<FeedDto> GetFeedForUserAsync(Guid userId, int page = 1, int pageSize = 20);
    Task<FeedDto> GetFilteredFeedForUserAsync(Guid userId, Guid[]? circleIds, int page = 1, int pageSize = 20);
    Task<List<PostDto>> GetAllPostsAsync(bool includeCommentCount = false);
    Task<IEnumerable<PostDto>> GetUserPostsAsync(Guid userId, int page = 1, int pageSize = 20);
    Task<PostDto> CreatePostAsync(Guid userId, Guid[] circleIds, string text);
    Task<PostDto?> UpdatePostAsync(Guid id, Guid updatedByUserId, string newText);
    Task<bool> DeletePostAsync(Guid id, Guid deletedByUserId);
    Task<bool> PostExistsAsync(Guid id);
    Task<int> SaveChangesAsync();
}

// Service implementation
public class PostService : IPostService
{
    private readonly CliqDbContext _dbContext;
    private readonly ICommentService _commentService;
    private readonly IFriendshipService _friendshipService;
    private readonly ICircleService _circleService;
    private readonly IMapper _mapper;
    private readonly ILogger<PostService> _logger;
    private readonly IEventNotificationService _eventNotificationService;

    public PostService(
        CliqDbContext dbContext,
        ICommentService commentService,
        IFriendshipService friendshipService,
        ICircleService circleService,
        IMapper mapper,
        ILogger<PostService> logger,
        IEventNotificationService eventNotificationService)
    {
        _dbContext = dbContext;
        _commentService = commentService;
        _friendshipService = friendshipService;
        _circleService = circleService;
        _mapper = mapper;
        _logger = logger;
        _eventNotificationService = eventNotificationService;
    }

    public async Task<PostDto?> GetPostByIdAsync(Guid requestorId, Guid id, bool includeCommentTree = true, int maxDepth = 3)
    {
        // First get the post with minimal data to check existence and ownership
        var post = await _dbContext.Posts
            .FirstOrDefaultAsync(p => p.Id == id);

        if (post == null)
        {
            _logger.LogWarning("User {UserId} attempted to access non-existent post {PostId}", requestorId, id);
            throw new BadHttpRequestException($"Post {id} not found");
        }

        bool isAuthorized = post.UserId == requestorId;

        // Only check circle membership if not already authorized as post owner
        if (!isAuthorized)
        {
            // Check if post is shared with any circle the requestor is a member of
            isAuthorized = await _dbContext.CirclePosts
                .Where(cp => cp.PostId == id)
                .AnyAsync(cp => _dbContext.CircleMemberships
                    .Any(cm => cm.CircleId == cp.CircleId && cm.UserId == requestorId));

            if (!isAuthorized)
            {
                _logger.LogWarning("User {UserId} attempted unauthorized access to post {PostId}", requestorId, id);
                return null;
            }
        }

        // User is authorized, load full post data with user info
        var fullPost = await _dbContext.Posts
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.Id == id);

        var dto = _mapper.Map<PostDto>(fullPost);

        if (includeCommentTree)
        {
            dto.Comments = (await _commentService.GetAllCommentsForPostAsync(id)).ToList();
        }

        return dto;
    }


    public async Task<FeedDto> GetFeedForUserAsync(Guid userId, int page = 1, int pageSize = 20)
    {
        try
        {
            /* Attempt at single query approach with group join for comment counting, gets System.InvalidOperationException: The LINQ expression 'DbSet<Post>()

            var result = await (
                from p in _dbContext.Posts
                    .Where(p => p.SharedWithCircles.Any(cp =>
                        cp.Circle.Members.Any(m => m.UserId == userId)))
                    .OrderByDescending(p => p.Date)
                    .Include(p => p.User)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                join c in _dbContext.Comments
                    on p.Id equals c.PostId into comments
                // Somehow get names of all the circles a given post was shared in
                join cp in _dbContext.Set<CirclePost>()
                    on p.Id equals cp.PostId into postCircles
                select new
                {
                    Post = p,
                    CommentCount = comments.Count(),
                    Circles = postCircles.Select(pc => new
                    {
                        pc.CircleId,
                        CircleName = pc.Circle.Name,
                        pc.Circle.IsShared,
                        pc.SharedAt
                    }).ToList()
                })
                .AsNoTracking()
                .ToListAsync();

            return result.Select(pc =>
            {
                var dto = _mapper.Map<PostDto>(pc.Post);
                dto.CommentCount = pc.CommentCount;
                dto.SharedWithCircles = pc.Circles.Select(c => new CirclePublicDtoInfo
                {
                    CircleId = c.CircleId,
                    CircleName = c.CircleName,
                    IsShared = c.IsShared,
                    SharedAt = c.SharedAt
                }).ToList();
                return dto;
            }).ToList();
            */

            // Step 1: Get post IDs for pagination (most efficient way to paginate)
            var postIds = await _dbContext.Posts
                .Where(p => p.SharedWithCircles.Any(cp =>
                    cp.Circle.Members.Any(m => m.UserId == userId)))
                .OrderByDescending(p => p.Date)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(p => p.Id)
                .ToListAsync();

            //if (!postIds.Any())
            //    return new List<PostDto>();

            // Step 2: Get posts with comments counts in one query using LEFT JOIN and GROUP BY
            var postsWithComments = await (
                from p in _dbContext.Posts.Include(p => p.User)
                where postIds.Contains(p.Id)
                join c in _dbContext.Comments
                    on p.Id equals c.PostId into comments
                orderby p.Date descending
                select new
                {
                    Post = p,
                    CommentCount = comments.Count()
                })
                .AsNoTracking()
                .ToListAsync();

            // Step 3: Get circle information in one query
            var circleInfo = await (
                from cp in _dbContext.CirclePosts
                where postIds.Contains(cp.PostId)
                join c in _dbContext.Circles on cp.CircleId equals c.Id
                // This Join + Where restricts the circles to be returned to only be those the user is a member/owner of
                join m in _dbContext.CircleMemberships on c.Id equals m.CircleId
                where m.UserId == userId
                select new
                {
                    PostId = cp.PostId,
                    CircleId = c.Id,
                    CircleName = c.Name,
                    IsShared = c.IsShared,
                    SharedAt = cp.SharedAt
                })
                .AsNoTracking()
                .ToListAsync();

            // Group circle info by post ID for easy lookup
            var circlesByPost = circleInfo
                .GroupBy(c => c.PostId)
                .ToDictionary(g => g.Key, g => g.ToList());

            this._logger.LogInformation("Done querying database for feed");
            // Combine the data
            var posts = postsWithComments.Select(pc =>
            {
                var dto = _mapper.Map<PostDto>(pc.Post);
                dto.CommentCount = pc.CommentCount;
                dto.SharedWithCircles = circlesByPost.ContainsKey(pc.Post.Id)
                    ? circlesByPost[pc.Post.Id].Select(c => new CirclePublicDto
                    {
                        Id = c.CircleId,
                        Name = c.CircleName,
                        IsShared = c.IsShared,
                    }).ToList()
                    : new List<CirclePublicDto>();
                return dto;
            }).ToList();

            var notificationCount = await _friendshipService.GetFriendRequestsCountAsync(userId);
            var userCircles = await _circleService.GetUserMemberCirclesAsync(userId);
            
            return new FeedDto
            {
                Posts = posts,
                NotificationCount = notificationCount,
                UserCircles = userCircles.ToList()
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving feed for user: {UserId}", userId);
            throw;
        }
    }

    public async Task<FeedDto> GetFilteredFeedForUserAsync(Guid userId, Guid[]? circleIds, int page = 1, int pageSize = 20)
    {
        try
        {
            IQueryable<Post> baseQuery;
            
            if (circleIds == null || circleIds.Length == 0)
            {
                // If no circles specified, return all posts user has access to (same as GetFeedForUserAsync)
                baseQuery = _dbContext.Posts
                    .Where(p => p.SharedWithCircles.Any(cp =>
                        cp.Circle != null && cp.Circle.Members.Any(m => m.UserId == userId)));
            }
            else
            {
                // Filter by specific circles
                baseQuery = _dbContext.Posts
                    .Where(p => p.SharedWithCircles.Any(cp =>
                        circleIds.Contains(cp.CircleId) &&
                        cp.Circle != null && cp.Circle.Members.Any(m => m.UserId == userId)));
            }

            // Step 1: Get post IDs for pagination
            var postIds = await baseQuery
                .OrderByDescending(p => p.Date)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(p => p.Id)
                .ToListAsync();

            // Step 2: Get posts with comment counts
            var postsWithComments = await (
                from p in _dbContext.Posts.Include(p => p.User)
                where postIds.Contains(p.Id)
                join c in _dbContext.Comments
                    on p.Id equals c.PostId into comments
                orderby p.Date descending
                select new
                {
                    Post = p,
                    CommentCount = comments.Count()
                })
                .AsNoTracking()
                .ToListAsync();

            // Step 3: Get circle information
            var circleInfo = await (
                from cp in _dbContext.CirclePosts
                where postIds.Contains(cp.PostId)
                join c in _dbContext.Circles on cp.CircleId equals c.Id
                join m in _dbContext.CircleMemberships on c.Id equals m.CircleId
                where m.UserId == userId
                select new
                {
                    PostId = cp.PostId,
                    CircleId = c.Id,
                    CircleName = c.Name,
                    IsShared = c.IsShared,
                    SharedAt = cp.SharedAt
                })
                .AsNoTracking()
                .ToListAsync();

            // Group circle info by post ID for easy lookup
            var circlesByPost = circleInfo
                .GroupBy(c => c.PostId)
                .ToDictionary(g => g.Key, g => g.ToList());

            // Combine the data
            var posts = postsWithComments.Select(pc =>
            {
                var dto = _mapper.Map<PostDto>(pc.Post);
                dto.CommentCount = pc.CommentCount;
                dto.SharedWithCircles = circlesByPost.ContainsKey(pc.Post.Id)
                    ? circlesByPost[pc.Post.Id].Select(c => new CirclePublicDto
                    {
                        Id = c.CircleId,
                        Name = c.CircleName,
                        IsShared = c.IsShared,
                    }).ToList()
                    : new List<CirclePublicDto>();
                return dto;
            }).ToList();

            var notificationCount = await _friendshipService.GetFriendRequestsCountAsync(userId);
            var userCircles = await _circleService.GetUserMemberCirclesAsync(userId);
            
            return new FeedDto
            {
                Posts = posts,
                NotificationCount = notificationCount,
                UserCircles = userCircles.ToList()
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving filtered feed for user: {UserId}, circleIds: {CircleIds}", userId, circleIds != null ? string.Join(",", circleIds) : "null");
            throw;
        }
    }

    public async Task<List<PostDto>> GetAllPostsAsync(bool includeCommentCount = false)
    {
        if (includeCommentCount)
        {
            // Single query approach using group join
            var result = await (
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
    public async Task<IEnumerable<PostDto>> GetUserPostsAsync(Guid userId, int page = 1, int pageSize = 20)
    {
        try
        {
            var posts = await _dbContext.Posts
                .Include(p => p.User)
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

    public async Task<PostDto> CreatePostAsync(Guid userId, Guid[] circleIds, string text)
    {
        var user = await this._dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            throw new Microsoft.AspNetCore.Http.BadHttpRequestException($"Cannot create post for invalid user {userId}");
        }

        await CircleService.ValidateAuthorizationToPostAsync(_dbContext, circleIds, userId);

        try
        {
            var post = new Post
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Text = text,
                Date = DateTime.UtcNow
            };

            var entry = await _dbContext.Posts.AddAsync(post);
            var circlePosts = circleIds.Select(circleId => new CirclePost
            {
                CircleId = circleId,
                PostId = post.Id,
                SharedAt = DateTime.UtcNow
            }).ToList();
            await _dbContext.CirclePosts.AddRangeAsync(circlePosts);
            await SaveChangesAsync();

            // Send notifications to circle members
            try
            {
                await _eventNotificationService.SendNewPostNotificationAsync(post.Id, userId, text, circleIds, user.Name);
            }
            catch (Exception ex)
            {
                // Log error but don't fail the post creation
                _logger.LogWarning(ex, "Failed to send post notifications for post {PostId}", post.Id);
            }

            // Reload the post with relationships
            await _dbContext.Entry(post)
                .Reference(p => p.User)
                .LoadAsync();

            await _dbContext.Entry(post)
                .Collection(p => p.SharedWithCircles)
                .Query()
                .Include(cp => cp.Circle)
                .LoadAsync();

            return this._mapper.Map<PostDto>(entry.Entity);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating post for user: {UserId}", userId);
            throw;
        }
    }

    public async Task<PostDto?> UpdatePostAsync(Guid id, Guid updatedByUserId, string newText)
    {
        try
        {
            var post = await this._dbContext.Posts
                        .FirstOrDefaultAsync(p => p.Id == id);

            if (post == null) return null;
            if (post.UserId != updatedByUserId)
            {
                throw new UnauthorizedAccessException($"User {updatedByUserId} is not authorized to update post {id}");
            }
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

    public async Task<bool> DeletePostAsync(Guid id, Guid deletedByUserId)
    {
        try
        {
            var post = await _dbContext.Posts.FindAsync(id);
            if (post == null) return false;
            if (post.UserId != deletedByUserId)
            {
                throw new UnauthorizedAccessException($"User {deletedByUserId} is not authorized to delete post {id}");
            }
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

    public async Task<bool> PostExistsAsync(Guid id)
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

    public static IServiceCollection AddCircleServices(this IServiceCollection services)
    {
        services.AddScoped<ICircleService, CircleService>();
        return services;
    }
}
