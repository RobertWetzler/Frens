using AutoMapper;
using Cliq.Server.Data;
using Cliq.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace Cliq.Server.Services;

public interface IPostService
{
    Task<PostDto?> GetPostByIdAsync(Guid requestorId, Guid id, bool includeCommentTree = false, int maxDepth = 3, bool includeImageUrl = false, int imageUrlExpirySeconds = 60);
    Task<FeedDto> GetFeedForUserAsync(Guid userId, int page = 1, int pageSize = 20);
    Task<FeedDto> GetFilteredFeedForUserAsync(Guid userId, Guid[]? circleIds, int page = 1, int pageSize = 20);
    Task<List<PostDto>> GetAllPostsAsync(bool includeCommentCount = false);
    Task<IEnumerable<PostDto>> GetUserPostsAsync(Guid userId, int page = 1, int pageSize = 20);
    Task<PostDto> CreatePostAsync(Guid userId, Guid[] circleIds, Guid[] userIds, string text, IEnumerable<string>? imageObjectKeys = null);
    Task<PostDto?> UpdatePostAsync(Guid id, Guid updatedByUserId, string newText);
    Task<bool> DeletePostAsync(Guid id, Guid deletedByUserId);
    Task<bool> PostExistsAsync(Guid id);
    Task<int> SaveChangesAsync();
    Task<string?> GetPostImageUrlAsync(Guid requestorId, Guid postId, int index, int expirySeconds = 60);
    Task<Dictionary<int,string>> GetPostImageUrlsAsync(Guid requestorId, Guid postId, IEnumerable<int> indices, int expirySeconds = 60);
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
    private readonly INotificationService _notificationService;
    private readonly IObjectStorageService _storage;
    private readonly MetricsService _metricsService;
    private readonly IUserActivityService _activityService;

    public PostService(
        CliqDbContext dbContext,
        ICommentService commentService,
        IFriendshipService friendshipService,
        ICircleService circleService,
        IMapper mapper,
        ILogger<PostService> logger,
    IEventNotificationService eventNotificationService,
    INotificationService notificationService,
    IObjectStorageService storage,
    MetricsService metricsService,
    IUserActivityService activityService)
    {
        _dbContext = dbContext;
        _commentService = commentService;
        _friendshipService = friendshipService;
        _circleService = circleService;
        _mapper = mapper;
        _logger = logger;
        _eventNotificationService = eventNotificationService;
        _notificationService = notificationService;
    _storage = storage;
    _metricsService = metricsService;
    _activityService = activityService;
    }

    public async Task<PostDto?> GetPostByIdAsync(Guid requestorId, Guid id, bool includeCommentTree = true, int maxDepth = 3, bool includeImageUrl = false, int imageUrlExpirySeconds = 60)
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

            isAuthorized = isAuthorized ||
                // Or if post is shared directly with the requestor
                await _dbContext.IndividualPosts
                    .AnyAsync(ip => ip.PostId == id && ip.UserId == requestorId);

            if (!isAuthorized)
            {
                _logger.LogWarning("User {UserId} attempted unauthorized access to post {PostId}", requestorId, id);
                return null;
            }
        }

        // User is authorized, load full post data with user info
        var fullPost = await _dbContext.Posts
            .Include(p => p.User)
            .Include(p => ((Event)p).Rsvps.Where(r => r.Status != RsvpStatus.NoResponse))
                .ThenInclude(r => r.User)
            .FirstOrDefaultAsync(p => p.Id == id);

        PostDto dto;
        
        // Check if the post is an event and map accordingly
        if (fullPost is Event eventPost)
        {
            var eventDto = _mapper.Map<EventDto>(eventPost);
            
            // Calculate RSVP counts
            eventDto.GoingCount = eventPost.Rsvps.Count(r => r.Status == RsvpStatus.Going);
            eventDto.MaybeCount = eventPost.Rsvps.Count(r => r.Status == RsvpStatus.Maybe);
            eventDto.NotGoingCount = eventPost.Rsvps.Count(r => r.Status == RsvpStatus.NotGoing);
            
            // Check if the current user has RSVP'd
            var userRsvp = eventPost.Rsvps.FirstOrDefault(r => r.UserId == requestorId);
            eventDto.CurrentUserRsvp = userRsvp?.Status;
            
            // Map RSVP details
            eventDto.Rsvps = eventPost.Rsvps
                .Select(r => _mapper.Map<EventRsvpDto>(r))
                .ToList();
            
            dto = eventDto;
        }
        else
        {
            dto = _mapper.Map<PostDto>(fullPost);
        }

        if (includeCommentTree)
        {
            dto.Comments = (await _commentService.GetAllCommentsForPostAsync(id)).ToList();
        }

        // Optionally attach short-lived image URL
    if (includeImageUrl && fullPost?.ImageObjectKeys.Any() == true)
        {
            try
            {
        // Return URL for the first image by default (could be extended to accept index)
        dto.ImageUrl = await _storage.GetTemporaryReadUrlAsync(fullPost.ImageObjectKeys.First(), imageUrlExpirySeconds);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed generating presigned image URL for post {PostId}", id);
            }
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
            // Include posts:
            // 1. Created by the user (so they see their own posts)
            // 2. Shared with user's circles
            // 3. Shared directly with the user
            // Also track which posts were shared directly with the user (for privacy flag)
            var postsWithSharingInfo = await _dbContext.Posts
                .Where(p => 
                    p.UserId == userId ||
                    p.SharedWithCircles.Any(cp =>
                        cp.Circle != null && cp.Circle.Members.Any(m => m.UserId == userId)) ||
                    p.SharedWithUsers.Any(ip => ip.UserId == userId))
                .OrderByDescending(p => p.Date)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(p => new
                {
                    PostId = p.Id,
                    SharedDirectlyWithUser = p.SharedWithUsers.Any(ip => ip.UserId == userId)
                })
                .ToListAsync();

            var postIds = postsWithSharingInfo.Select(p => p.PostId).ToList();
            var postsSharedWithCurrentUserSet = postsWithSharingInfo
                .Where(p => p.SharedDirectlyWithUser)
                .Select(p => p.PostId)
                .ToHashSet();

            //if (!postIds.Any())
            //    return new List<PostDto>();

            // Step 2: Get posts with comments counts in one query using LEFT JOIN and GROUP BY
            // Include event-specific data and RSVP information for events
            var postsWithComments = await (
                from p in _dbContext.Posts
                    .Include(p => p.User)
                    .Include(p => ((Event)p).Rsvps.Where(r => r.Status != RsvpStatus.NoResponse))
                        .ThenInclude(r => r.User)
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

            // Step 4: Get full sharing info ONLY for posts owned by the current user (for privacy)
            var ownedPostIds = postsWithComments
                .Where(pc => pc.Post.UserId == userId)
                .Select(pc => pc.Post.Id)
                .ToList();

            var userInfoForOwnedPosts = await (
                from ip in _dbContext.IndividualPosts
                where ownedPostIds.Contains(ip.PostId)
                join u in _dbContext.Users on ip.UserId equals u.Id
                select new
                {
                    PostId = ip.PostId,
                    UserId = u.Id,
                    UserName = u.Name
                })
                .AsNoTracking()
                .ToListAsync();

            var usersByPost = userInfoForOwnedPosts
                .GroupBy(u => u.PostId)
                .ToDictionary(g => g.Key, g => g.ToList());

            this._logger.LogInformation("Done querying database for feed");
            // Combine the data
            var posts = postsWithComments.Select(pc =>
            {
                PostDto dto;
                
                // Check if the post is an event and map accordingly
                if (pc.Post is Event eventPost)
                {
                    var eventDto = _mapper.Map<EventDto>(eventPost);
                    
                    // Calculate RSVP counts
                    eventDto.GoingCount = eventPost.Rsvps.Count(r => r.Status == RsvpStatus.Going);
                    eventDto.MaybeCount = eventPost.Rsvps.Count(r => r.Status == RsvpStatus.Maybe);
                    eventDto.NotGoingCount = eventPost.Rsvps.Count(r => r.Status == RsvpStatus.NotGoing);
                    
                    // Check if the current user has RSVP'd
                    var userRsvp = eventPost.Rsvps.FirstOrDefault(r => r.UserId == userId);
                    eventDto.CurrentUserRsvp = userRsvp?.Status;
                    
                    // Map RSVP details
                    eventDto.Rsvps = eventPost.Rsvps
                        .Where(r => r.Status != RsvpStatus.NoResponse)
                        .Select(r => _mapper.Map<EventRsvpDto>(r))
                        .ToList();
                    
                    dto = eventDto;
                }
                else
                {
                    dto = _mapper.Map<PostDto>(pc.Post);
                }
                
                dto.CommentCount = pc.CommentCount;
                dto.SharedWithCircles = circlesByPost.ContainsKey(pc.Post.Id)
                    ? circlesByPost[pc.Post.Id].Select(c => new CirclePublicDto
                    {
                        Id = c.CircleId,
                        Name = c.CircleName,
                        IsShared = c.IsShared,
                    }).ToList()
                    : new List<CirclePublicDto>();
                
                // Privacy: Only show full SharedWithUsers list to post owner
                bool isOwner = pc.Post.UserId == userId;
                if (isOwner && usersByPost.ContainsKey(pc.Post.Id))
                {
                    dto.SharedWithUsers = usersByPost[pc.Post.Id].Select(u => new UserDto
                    {
                        Id = u.UserId,
                        Name = u.UserName
                    }).ToList();
                }
                else
                {
                    dto.SharedWithUsers = new List<UserDto>();
                }
                
                // Set flag if this post was shared directly with the current user
                dto.SharedWithYouDirectly = postsSharedWithCurrentUserSet.Contains(pc.Post.Id);
                
                return dto;
            }).ToList();

            var notifications = await _notificationService.GetNotifications(userId);
            var notificationCount = notifications.friendRequests.Count() + notifications.notifications.Count();
            var userCircles = await _circleService.GetUserMemberCirclesAsync(userId);
            
            // Increment custom metrics for home feed loads
            _metricsService.IncrementHomeFeedLoads();

            // Record user activity for DAU/WAU/MAU tracking (fire-and-forget)
            _ = Task.Run(async () => await _activityService.RecordActivityAsync(userId, UserActivityType.FeedLoaded));
            
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
                    .Where(p => 
                        p.UserId == userId ||
                        p.SharedWithCircles.Any(cp =>
                            cp.Circle != null && cp.Circle.Members.Any(m => m.UserId == userId)) ||
                        p.SharedWithUsers.Any(ip => ip.UserId == userId));
            }
            else
            {
                // Filter by specific circles (still include posts created by user and shared directly with user)
                baseQuery = _dbContext.Posts
                    .Where(p => 
                        p.UserId == userId ||
                        p.SharedWithCircles.Any(cp =>
                            circleIds.Contains(cp.CircleId) &&
                            cp.Circle != null && cp.Circle.Members.Any(m => m.UserId == userId)) ||
                        p.SharedWithUsers.Any(ip => ip.UserId == userId));
            }

            // Step 1: Get post IDs for pagination
            // Also track which posts were shared directly with the user (for privacy flag)
            var postsWithSharingInfo = await baseQuery
                .OrderByDescending(p => p.Date)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(p => new
                {
                    PostId = p.Id,
                    SharedDirectlyWithUser = p.SharedWithUsers.Any(ip => ip.UserId == userId)
                })
                .ToListAsync();

            var postIds = postsWithSharingInfo.Select(p => p.PostId).ToList();
            var postsSharedWithCurrentUserSet = postsWithSharingInfo
                .Where(p => p.SharedDirectlyWithUser)
                .Select(p => p.PostId)
                .ToHashSet();

            // Step 2: Get posts with comment counts
            var postsWithComments = await (
                from p in _dbContext.Posts
                    .Include(p => p.User)
                    .Include(p => ((Event)p).Rsvps.Where(r => r.Status != RsvpStatus.NoResponse))
                        .ThenInclude(r => r.User)
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
                    SharedAt = cp.SharedAt,
                    c.IsSubscribable
                })
                .AsNoTracking()
                .ToListAsync();

            // Group circle info by post ID for easy lookup
            var circlesByPost = circleInfo
                .GroupBy(c => c.PostId)
                .ToDictionary(g => g.Key, g => g.ToList());

            // Step 4: Get full sharing info ONLY for posts owned by the current user (for privacy)
            var ownedPostIds = postsWithComments
                .Where(pc => pc.Post.UserId == userId)
                .Select(pc => pc.Post.Id)
                .ToList();

            var userInfoForOwnedPosts = await (
                from ip in _dbContext.IndividualPosts
                where ownedPostIds.Contains(ip.PostId)
                join u in _dbContext.Users on ip.UserId equals u.Id
                select new
                {
                    PostId = ip.PostId,
                    UserId = u.Id,
                    UserName = u.Name
                })
                .AsNoTracking()
                .ToListAsync();

            var usersByPost = userInfoForOwnedPosts
                .GroupBy(u => u.PostId)
                .ToDictionary(g => g.Key, g => g.ToList());

            // Combine the data
            var posts = postsWithComments.Select(pc =>
            {
                PostDto dto;
                
                // Check if the post is an event and map accordingly
                if (pc.Post is Event eventPost)
                {
                    var eventDto = _mapper.Map<EventDto>(eventPost);
                    
                    // Calculate RSVP counts
                    eventDto.GoingCount = eventPost.Rsvps.Count(r => r.Status == RsvpStatus.Going);
                    eventDto.MaybeCount = eventPost.Rsvps.Count(r => r.Status == RsvpStatus.Maybe);
                    eventDto.NotGoingCount = eventPost.Rsvps.Count(r => r.Status == RsvpStatus.NotGoing);
                    
                    // Check if the current user has RSVP'd
                    var userRsvp = eventPost.Rsvps.FirstOrDefault(r => r.UserId == userId);
                    eventDto.CurrentUserRsvp = userRsvp?.Status;
                    
                    // Map RSVP details
                    eventDto.Rsvps = eventPost.Rsvps
                        .Where(r => r.Status != RsvpStatus.NoResponse)
                        .Select(r => _mapper.Map<EventRsvpDto>(r))
                        .ToList();
                    
                    dto = eventDto;
                }
                else
                {
                    dto = _mapper.Map<PostDto>(pc.Post);
                }
                
                dto.CommentCount = pc.CommentCount;
                dto.SharedWithCircles = circlesByPost.ContainsKey(pc.Post.Id)
                    ? circlesByPost[pc.Post.Id].Select(c => new CirclePublicDto
                    {
                        Id = c.CircleId,
                        Name = c.CircleName,
                        IsShared = c.IsShared,
                        IsSubscribable = c.IsSubscribable
                    }).ToList()
                    : new List<CirclePublicDto>();
                
                // Privacy: Only show full SharedWithUsers list to post owner
                bool isOwner = pc.Post.UserId == userId;
                if (isOwner && usersByPost.ContainsKey(pc.Post.Id))
                {
                    dto.SharedWithUsers = usersByPost[pc.Post.Id].Select(u => new UserDto
                    {
                        Id = u.UserId,
                        Name = u.UserName
                    }).ToList();
                }
                else
                {
                    dto.SharedWithUsers = new List<UserDto>();
                }
                
                // Set flag if this post was shared directly with the current user
                dto.SharedWithYouDirectly = postsSharedWithCurrentUserSet.Contains(pc.Post.Id);
                
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
                    .Include(p => ((Event)p).Rsvps.Where(r => r.Status != RsvpStatus.NoResponse))
                        .ThenInclude(r => r.User)
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
                PostDto dto;
                
                // Check if the post is an event and map accordingly
                if (pc.Post is Event eventPost)
                {
                    var eventDto = _mapper.Map<EventDto>(eventPost);
                    
                    // Calculate RSVP counts (no userId available, so no CurrentUserRsvp)
                    eventDto.GoingCount = eventPost.Rsvps.Count(r => r.Status == RsvpStatus.Going);
                    eventDto.MaybeCount = eventPost.Rsvps.Count(r => r.Status == RsvpStatus.Maybe);
                    eventDto.NotGoingCount = eventPost.Rsvps.Count(r => r.Status == RsvpStatus.NotGoing);
                    
                    // Map RSVP details
                    eventDto.Rsvps = eventPost.Rsvps
                        .Where(r => r.Status != RsvpStatus.NoResponse)
                        .Select(r => _mapper.Map<EventRsvpDto>(r))
                        .ToList();
                    
                    dto = eventDto;
                }
                else
                {
                    dto = _mapper.Map<PostDto>(pc.Post);
                }
                
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

    public async Task<PostDto> CreatePostAsync(Guid userId, Guid[] circleIds, Guid[] userIds, string text, IEnumerable<string>? imageObjectKeys = null)
    {
        var user = await this._dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            throw new BadHttpRequestException($"Cannot create post for invalid user {userId}");
        }

        await ValidateAuthorizationToPostAsync(_dbContext, circleIds, userIds, userId);

        // Use explicit transaction to ensure atomicity
        using var transaction = await _dbContext.Database.BeginTransactionAsync();
        try
        {
            var post = new Post
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Text = text,
                Date = DateTime.UtcNow,
                ImageObjectKeys = imageObjectKeys?.ToList() ?? new List<string>()
            };

            var entry = await _dbContext.Posts.AddAsync(post);
            var circlePosts = circleIds.Select(circleId => new CirclePost
            {
                CircleId = circleId,
                PostId = post.Id,    
                SharedAt = DateTime.UtcNow
            }).ToList();

            var individualPosts = userIds.Select(targetUserId => new IndividualPost
            {
                UserId = targetUserId,
                PostId = post.Id,
                SharedAt = DateTime.UtcNow
            }).ToList();

            await _dbContext.IndividualPosts.AddRangeAsync(individualPosts);
            await _dbContext.CirclePosts.AddRangeAsync(circlePosts);
            await SaveChangesAsync();

            // Reload the post with relationships before committing
            await _dbContext.Entry(post)
                .Reference(p => p.User)
                .LoadAsync();

            await _dbContext.Entry(post)
                .Collection(p => p.SharedWithCircles)
                .Query()
                .Include(cp => cp.Circle)
                .LoadAsync();

            await _dbContext.Entry(post)
                .Collection(p => p.SharedWithUsers)
                .Query()
                .Include(ip => ip.User)
                .LoadAsync();

            // Create notification rows in the same transaction to guarantee atomicity
            // The actual push notification sending happens asynchronously via background worker
            try
            {
                await _eventNotificationService.SendNewPostNotificationAsync(
                    post.Id, 
                    userId, 
                    text, 
                    circleIds, 
                    user.Name, 
                    imageObjectKeys != null && imageObjectKeys.Any());
            }
            catch (Exception ex)
            {
                // If notification creation fails, rollback the entire transaction
                _logger.LogError(ex, "Failed to create notification rows for post {PostId}, rolling back transaction", post.Id);
                throw; // This will cause the transaction to rollback on dispose
            }

            // Commit transaction - all database changes are now persisted atomically
            await transaction.CommitAsync();

            // Increment custom metrics for post creation
            _metricsService.IncrementPostsCreated();

            // Record user activity for DAU/WAU/MAU tracking (fire-and-forget)
            _ = Task.Run(async () => await _activityService.RecordActivityAsync(userId, UserActivityType.PostCreated));

            var dto = this._mapper.Map<PostDto>(entry.Entity);
            dto.HasImage = post.ImageObjectKeys.Any();
            dto.ImageCount = post.ImageObjectKeys.Count;
            return dto;
        }
        catch (Exception ex)
        {
            // Transaction will automatically rollback on dispose if not committed
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

    public async Task<string?> GetPostImageUrlAsync(Guid requestorId, Guid postId, int index, int expirySeconds = 60)
    {
        var post = await _dbContext.Posts.FirstOrDefaultAsync(p => p.Id == postId);
        if (post == null) return null;
        // Authorization reuse
        var auth = await GetPostByIdAsync(requestorId, postId, includeCommentTree:false, includeImageUrl:false);
        if (auth == null) return null;
        if (index < 0 || index >= post.ImageObjectKeys.Count) return null;
        try
        {
            return await _storage.GetTemporaryReadUrlAsync(post.ImageObjectKeys[index], expirySeconds);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed generating presigned image URL for post {PostId} index {Index}", postId, index);
            return null;
        }
    }

    public async Task<Dictionary<int, string>> GetPostImageUrlsAsync(Guid requestorId, Guid postId, IEnumerable<int> indices, int expirySeconds = 60)
    {
        var map = new Dictionary<int, string>();
        var post = await _dbContext.Posts.FirstOrDefaultAsync(p => p.Id == postId);
        if (post == null) return map;
        // internally performs authorization check
        // TODO: optimize to avoid double DB fetch
        var auth = await GetPostByIdAsync(requestorId, postId, includeCommentTree: false, includeImageUrl: false);
        if (auth == null) return map;
        foreach (var idx in indices.Distinct())
        {
            if (idx < 0 || idx >= post.ImageObjectKeys.Count) continue;
            try
            {
                map[idx] = await _storage.GetTemporaryReadUrlAsync(post.ImageObjectKeys[idx], expirySeconds);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed generating presigned image URL for post {PostId} index {Index}", postId, idx);
            }
        }
        return map;
    }
    
    public static async Task ValidateAuthorizationToPostAsync(CliqDbContext dbContext, Guid[] circleIds, Guid[] userIds, Guid userId)
    {
        // VALIDATE USER IS MEMBER/OWNER OF CIRCLES
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

        // VALIDATE USERS ARE FRIENDS
        if (userIds.Length > 0)
        {
            // Count how many of the target users are friends with userId
            var friendshipCount = await dbContext.Friendships
                .Where(f => 
                    userIds.Contains(f.RequesterId) || userIds.Contains(f.AddresseeId))
                .Where(f => 
                    (f.RequesterId == userId || f.AddresseeId == userId) &&
                    f.Status == FriendshipStatus.Accepted)
                .CountAsync();

            // If the count doesn't match the number of target users, some are not friends
            if (friendshipCount != userIds.Length)
            {
                // Optionally, identify which users are not friends for a better error message
                var friendUserIds = await dbContext.Friendships
                    .Where(f => 
                        ((f.RequesterId == userId && userIds.Contains(f.AddresseeId)) ||
                         (f.AddresseeId == userId && userIds.Contains(f.RequesterId))) &&
                        f.Status == FriendshipStatus.Accepted)
                    .Select(f => f.RequesterId == userId ? f.AddresseeId : f.RequesterId)
                    .ToListAsync();

                var nonFriendUserIds = userIds.Except(friendUserIds).ToList();
                throw new UnauthorizedAccessException(
                    $"Cannot create post: User is not friends with {nonFriendUserIds.Count} user(s): {string.Join(", ", nonFriendUserIds)}");
            }
        }
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
