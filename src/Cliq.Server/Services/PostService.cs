using AutoMapper;
using Cliq.Server.Data;
using Cliq.Server.Models;
using Cliq.Server.Utilities;
using Microsoft.EntityFrameworkCore;

namespace Cliq.Server.Services;

public interface IPostService
{
    Task<PostDto?> GetPostByIdAsync(Guid requestorId, Guid id, bool includeCommentTree = false, int maxDepth = 3, bool includeImageUrl = false, int imageUrlExpirySeconds = 60);
    Task<FeedDto> GetFeedForUserAsync(Guid userId, int page = 1, int pageSize = 20);
    Task<FeedDto> GetFilteredFeedForUserAsync(Guid userId, Guid[]? circleIds, int page = 1, int pageSize = 20);
    Task<List<PostDto>> GetAllPostsAsync(bool includeCommentCount = false);
    Task<IEnumerable<PostDto>> GetUserPostsAsync(Guid userId, int page = 1, int pageSize = 20);
    Task<PostDto> CreatePostAsync(Guid userId, Guid[] circleIds, Guid[] userIds, string text, IEnumerable<string>? imageObjectKeys = null, List<MentionDto>? mentions = null, string[]? interestNames = null, bool announceNewInterests = false);
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
    private readonly IInterestService _interestService;

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
    IUserActivityService activityService,
    IInterestService interestService)
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
    _interestService = interestService;
    }

    /// <summary>
    /// Populates ProfilePictureUrl for a UserDto based on the user's ProfilePictureKey.
    /// </summary>
    private void PopulateProfilePictureUrl(UserDto? userDto, User? user)
    {
        if (userDto != null && user != null && !string.IsNullOrEmpty(user.ProfilePictureKey))
        {
            userDto.ProfilePictureUrl = _storage.GetProfilePictureUrl(user.ProfilePictureKey);
        }
    }

    /// <summary>
    /// Populates profile picture URLs for all users in a PostDto.
    /// </summary>
    private void PopulatePostProfilePictureUrls(PostDto dto, Post post)
    {
        PopulateProfilePictureUrl(dto.User, post.User);
        // SharedWithUsers is handled separately as it may be populated from a different source
    }

    /// <summary>
    /// Gets the list of users that can be mentioned when commenting on a post.
    /// This includes the post author (always), plus:
    /// - For shared/public circles: all members are visible to everyone
    /// - For private circles: only the owner can see/mention members
    /// </summary>
    private async Task<List<MentionableUserDto>> GetMentionableUsersForPostAsync(Guid postId, Guid viewerId)
    {
        var mentionableUsers = new List<MentionableUserDto>();
        var addedUserIds = new HashSet<Guid>();

        // Get the post with its author
        var post = await _dbContext.Posts
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.Id == postId);

        if (post == null) return mentionableUsers;

        // Always include the post author (except if viewer is the author)
        if (post.User != null && post.UserId != viewerId)
        {
            mentionableUsers.Add(new MentionableUserDto
            {
                Id = post.User.Id,
                Name = post.User.Name,
                ProfilePictureUrl = !string.IsNullOrEmpty(post.User.ProfilePictureKey)
                    ? _storage.GetProfilePictureUrl(post.User.ProfilePictureKey)
                    : null
            });
            addedUserIds.Add(post.User.Id);
        }

        // Get members from shared/public circles (visible to everyone)
        var sharedCircleMembers = await _dbContext.CirclePosts
            .Where(cp => cp.PostId == postId)
            .Join(_dbContext.Circles, cp => cp.CircleId, c => c.Id, (cp, c) => c)
            .Where(c => c.IsShared) // Only shared/public circles
            .SelectMany(c => c.Members.Select(m => m.User))
            .Where(u => u != null && u.Id != viewerId)
            .Select(u => new { u!.Id, u.Name, u.ProfilePictureKey })
            .Distinct()
            .ToListAsync();

        foreach (var member in sharedCircleMembers)
        {
            if (!addedUserIds.Contains(member.Id))
            {
                mentionableUsers.Add(new MentionableUserDto
                {
                    Id = member.Id,
                    Name = member.Name,
                    ProfilePictureUrl = !string.IsNullOrEmpty(member.ProfilePictureKey)
                        ? _storage.GetProfilePictureUrl(member.ProfilePictureKey)
                        : null
                });
                addedUserIds.Add(member.Id);
            }
        }

        // Get members from private circles where the viewer is the owner
        // (only the owner can see members of their private circles)
        var privateCircleMembers = await _dbContext.CirclePosts
            .Where(cp => cp.PostId == postId)
            .Join(_dbContext.Circles, cp => cp.CircleId, c => c.Id, (cp, c) => c)
            .Where(c => !c.IsShared && c.OwnerId == viewerId) // Private circles owned by viewer
            .SelectMany(c => c.Members.Select(m => m.User))
            .Where(u => u != null && u.Id != viewerId)
            .Select(u => new { u!.Id, u.Name, u.ProfilePictureKey })
            .Distinct()
            .ToListAsync();

        foreach (var member in privateCircleMembers)
        {
            if (!addedUserIds.Contains(member.Id))
            {
                mentionableUsers.Add(new MentionableUserDto
                {
                    Id = member.Id,
                    Name = member.Name,
                    ProfilePictureUrl = !string.IsNullOrEmpty(member.ProfilePictureKey)
                        ? _storage.GetProfilePictureUrl(member.ProfilePictureKey)
                        : null
                });
                addedUserIds.Add(member.Id);
            }
        }

        // Include circle owners for shared circles (not private - those are owned by viewer already)
        var circleOwners = await _dbContext.CirclePosts
            .Where(cp => cp.PostId == postId)
            .Join(_dbContext.Circles, cp => cp.CircleId, c => c.Id, (cp, c) => c)
            .Where(c => c.IsShared && c.Owner != null && c.OwnerId != viewerId)
            .Select(c => new { c.Owner!.Id, c.Owner.Name, c.Owner.ProfilePictureKey })
            .Distinct()
            .ToListAsync();

        foreach (var owner in circleOwners)
        {
            if (!addedUserIds.Contains(owner.Id))
            {
                mentionableUsers.Add(new MentionableUserDto
                {
                    Id = owner.Id,
                    Name = owner.Name,
                    ProfilePictureUrl = !string.IsNullOrEmpty(owner.ProfilePictureKey)
                        ? _storage.GetProfilePictureUrl(owner.ProfilePictureKey)
                        : null
                });
                addedUserIds.Add(owner.Id);
            }
        }

        return mentionableUsers;
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
        
        // Populate profile picture URL for post author
        PopulatePostProfilePictureUrls(dto, fullPost);

        if (includeCommentTree)
        {
            dto.Comments = (await _commentService.GetAllCommentsForPostAsync(id)).ToList();
        }

        // Populate mentionable users for comment dropdowns
        dto.MentionableUsers = await GetMentionableUsersForPostAsync(id, requestorId);

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
            // 4. Shared to interests the user follows, from friends
            // Also track which posts were shared directly with the user (for privacy flag)

            // Pre-fetch the user's followed interest IDs and friend IDs for the interest query
            var followedInterestIds = await _dbContext.InterestSubscriptions
                .Where(s => s.UserId == userId)
                .Select(s => s.InterestId)
                .ToListAsync();

            var friendIdsForInterests = (await _friendshipService.GetFriendsAsync(userId))
                .Select(f => f.Id).ToList();

            var postsWithSharingInfo = await _dbContext.Posts
                .Where(p => 
                    p.UserId == userId ||
                    p.SharedWithCircles.Any(cp =>
                        cp.Circle != null && cp.Circle.Members.Any(m => m.UserId == userId)) ||
                    p.SharedWithUsers.Any(ip => ip.UserId == userId) ||
                    // Interest-based: post is in an interest the user follows, from a friend
                    (p.SharedWithInterests.Any(ip => followedInterestIds.Contains(ip.InterestId)) &&
                     friendIdsForInterests.Contains(p.UserId)))
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

            // Step 3b: Get interest information for posts (filtered to viewer's followed interests for privacy)
            var interestsByPost = await _interestService.GetInterestsForPostsAsync(postIds, followedInterestIds);

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
                
                // Populate profile picture URL for post author
                PopulatePostProfilePictureUrls(dto, pc.Post);
                
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

                // Populate interests for this post
                dto.SharedWithInterests = interestsByPost.TryGetValue(pc.Post.Id, out var interests)
                    ? interests
                    : new List<InterestPublicDto>();
                
                return dto;
            }).ToList();

            var notifications = await _notificationService.GetNotifications(userId);
            var notificationCount = notifications.friendRequests.Count() + notifications.notifications.Count();
            var userCircles = await _circleService.GetUserMemberCirclesAsync(userId);
            
            // Only fetch recommended content on first page to improve performance
            var availableSubscribableCircles = new List<SubscribableCircleDto>();
            var recommendedFriends = new List<RecommendedFriendDto>();
            var suggestedInterests = new List<InterestSuggestionDto>();
            
            if (page == 1)
            {
                // Get subscribable circles from friends that the user is not a member of
                var friends = await _friendshipService.GetFriendsAsync(userId);
                var friendIds = friends.Select(f => f.Id).ToList();
                
                // Get user's current circle memberships to exclude circles they're already in
                var userCircleIds = await _dbContext.CircleMemberships
                    .Where(cm => cm.UserId == userId)
                    .Select(cm => cm.CircleId)
                    .ToListAsync();
                
                // Get subscribable circles from friends where user is not a member
                availableSubscribableCircles = await _dbContext.Circles
                    .Where(c => c.IsSubscribable && 
                               friendIds.Contains(c.OwnerId) && 
                               !userCircleIds.Contains(c.Id))
                    .Include(c => c.Owner)
                    .Select(c => new SubscribableCircleDto
                    {
                        Id = c.Id,
                        Name = c.Name,
                        Owner = new UserDto
                        {
                            Id = c.Owner!.Id,
                            Name = c.Owner.Name,
                            ProfilePictureUrl = !string.IsNullOrEmpty(c.Owner.ProfilePictureKey)
                                ? _storage.GetProfilePictureUrl(c.Owner.ProfilePictureKey)
                                : null
                        }
                    })
                    .ToListAsync();
                
                // Get recommended friends based on mutual connections (single optimized query)
                recommendedFriends = await _friendshipService.GetRecommendedFriendsRawSqlAsync(userId, limit: 5, minimumMutualFriends: 2);

                // Get recommended interests: popular among friends but not yet followed
                suggestedInterests = await _interestService.GetRecommendedInterestsForFeedAsync(userId, limit: 5);
            }
            
            // Increment custom metrics for home feed loads
            _metricsService.IncrementHomeFeedLoads();

            // Record user activity for DAU/WAU/MAU tracking (fire-and-forget)
            _ = Task.Run(async () => await _activityService.RecordActivityAsync(userId, UserActivityType.FeedLoaded));
            
            return new FeedDto
            {
                Posts = posts,
                NotificationCount = notificationCount,
                UserCircles = userCircles.ToList(),
                AvailableSubscribableCircles = availableSubscribableCircles,
                RecommendedFriends = recommendedFriends,
                SuggestedInterests = suggestedInterests
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

            // Pre-fetch the user's followed interest IDs and friend IDs for interest queries
            var filteredFollowedInterestIds = await _dbContext.InterestSubscriptions
                .Where(s => s.UserId == userId)
                .Select(s => s.InterestId)
                .ToListAsync();

            var filteredFriendIds = (await _friendshipService.GetFriendsAsync(userId))
                .Select(f => f.Id).ToList();
            
            if (circleIds == null || circleIds.Length == 0)
            {
                // If no circles specified, return all posts user has access to (same as GetFeedForUserAsync)
                baseQuery = _dbContext.Posts
                    .Where(p => 
                        p.UserId == userId ||
                        p.SharedWithCircles.Any(cp =>
                            cp.Circle != null && cp.Circle.Members.Any(m => m.UserId == userId)) ||
                        p.SharedWithUsers.Any(ip => ip.UserId == userId) ||
                        // Interest-based: post is in an interest the user follows, from a friend
                        (p.SharedWithInterests.Any(ip => filteredFollowedInterestIds.Contains(ip.InterestId)) &&
                         filteredFriendIds.Contains(p.UserId)));
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

            // Step 3b: Get interest information for posts (filtered to viewer's followed interests for privacy)
            var filteredInterestsByPost = await _interestService.GetInterestsForPostsAsync(postIds, filteredFollowedInterestIds);

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
                
                // Populate profile picture URL for post author
                PopulatePostProfilePictureUrls(dto, pc.Post);
                
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

                // Populate interests for this post
                dto.SharedWithInterests = filteredInterestsByPost.TryGetValue(pc.Post.Id, out var filteredInterests)
                    ? filteredInterests
                    : new List<InterestPublicDto>();
                
                return dto;
            }).ToList();

            var notificationCount = await _friendshipService.GetFriendRequestsCountAsync(userId);
            var userCircles = await _circleService.GetUserMemberCirclesAsync(userId);
            
            // Only fetch recommended content on first page to improve performance
            var availableSubscribableCircles = new List<SubscribableCircleDto>();
            var recommendedFriends = new List<RecommendedFriendDto>();
            var suggestedInterests = new List<InterestSuggestionDto>();
            
            if (page == 1)
            {
                // Get subscribable circles from friends that the user is not a member of
                var friends = await _friendshipService.GetFriendsAsync(userId);
                var friendIds = friends.Select(f => f.Id).ToList();
                
                // Get user's current circle memberships to exclude circles they're already in
                var userCircleIds = await _dbContext.CircleMemberships
                    .Where(cm => cm.UserId == userId)
                    .Select(cm => cm.CircleId)
                    .ToListAsync();
                
                // Get subscribable circles from friends where user is not a member
                availableSubscribableCircles = await _dbContext.Circles
                    .Where(c => c.IsSubscribable && 
                               friendIds.Contains(c.OwnerId) && 
                               !userCircleIds.Contains(c.Id))
                    .Include(c => c.Owner)
                    .Select(c => new SubscribableCircleDto
                    {
                        Id = c.Id,
                        Name = c.Name,
                        Owner = new UserDto
                        {
                            Id = c.Owner!.Id,
                            Name = c.Owner.Name,
                            ProfilePictureUrl = !string.IsNullOrEmpty(c.Owner.ProfilePictureKey)
                                ? _storage.GetProfilePictureUrl(c.Owner.ProfilePictureKey)
                                : null
                        }
                    })
                    .ToListAsync();
                
                // Get recommended friends based on mutual connections (single optimized query)
                recommendedFriends = await _friendshipService.GetRecommendedFriendsRawSqlAsync(userId, limit: 5, minimumMutualFriends: 2);

                // Get recommended interests: popular among friends but not yet followed
                suggestedInterests = await _interestService.GetRecommendedInterestsForFeedAsync(userId, limit: 5);
            }
            
            return new FeedDto
            {
                Posts = posts,
                NotificationCount = notificationCount,
                UserCircles = userCircles.ToList(),
                AvailableSubscribableCircles = availableSubscribableCircles,
                RecommendedFriends = recommendedFriends,
                SuggestedInterests = suggestedInterests
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
                
                // Populate profile picture URL for post author
                PopulatePostProfilePictureUrls(dto, pc.Post);
                
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

    public async Task<PostDto> CreatePostAsync(Guid userId, Guid[] circleIds, Guid[] userIds, string text, IEnumerable<string>? imageObjectKeys = null, List<MentionDto>? mentions = null, string[]? interestNames = null, bool announceNewInterests = false)
    {
        var user = await this._dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            throw new BadHttpRequestException($"Cannot create post for invalid user {userId}");
        }

        await ValidateAuthorizationToPostAsync(_dbContext, circleIds, userIds, userId);

        // Validate mentions if provided
        var validatedMentions = new List<MentionDto>();
        if (mentions != null && mentions.Any())
        {
            validatedMentions = await MentionParser.ValidateMentionsAsync(
                text,
                mentions,
                userId,
                _dbContext,
                _friendshipService);
        }

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
                ImageObjectKeys = imageObjectKeys?.ToList() ?? new List<string>(),
                Mentions = validatedMentions
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

            // Handle interests: get-or-create each interest and link to the post
            if (interestNames != null && interestNames.Length > 0)
            {
                foreach (var interestName in interestNames.Distinct())
                {
                    var (normalizedName, displayName, validationError) = Utilities.InterestNameHelper.NormalizeAndValidate(interestName);
                    if (validationError != null)
                    {
                        _logger.LogWarning("Skipping invalid interest name '{InterestName}': {Error}", interestName, validationError);
                        continue;
                    }

                    var interest = await _interestService.GetOrCreateInterestAsync(normalizedName, displayName, userId);

                    var interestPost = new InterestPost
                    {
                        InterestId = interest.Id,
                        PostId = post.Id,
                        SharedAt = DateTime.UtcNow,
                        WasAnnounced = false
                    };
                    await _dbContext.InterestPosts.AddAsync(interestPost);

                    // Auto-subscribe the poster to the interest if not already following
                    var alreadyFollowing = await _dbContext.InterestSubscriptions
                        .AnyAsync(s => s.InterestId == interest.Id && s.UserId == userId);
                    if (!alreadyFollowing)
                    {
                        await _dbContext.InterestSubscriptions.AddAsync(new InterestSubscription
                        {
                            InterestId = interest.Id,
                            UserId = userId,
                            SubscribedAt = DateTime.UtcNow
                        });
                    }

                    // Handle announcement for new interests
                    if (announceNewInterests)
                    {
                        var friendsFollowing = await _dbContext.InterestSubscriptions
                            .AnyAsync(s => s.InterestId == interest.Id && s.UserId != userId);
                        if (!friendsFollowing && await _interestService.CanAnnounceInterestAsync(userId))
                        {
                            interestPost.WasAnnounced = true;
                            await _interestService.RecordAnnouncementAsync(userId, interest.Id);
                            // TODO: Send announcement notifications to all friends
                        }
                    }
                }
            }

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
                // Get mentioned user IDs to exclude from regular post notifications
                var mentionedUserIds = MentionParser.GetMentionedUserIds(validatedMentions);
                
                await _eventNotificationService.SendNewPostNotificationAsync(
                    post.Id, 
                    userId, 
                    text, 
                    circleIds, 
                    user.Name, 
                    imageObjectKeys != null && imageObjectKeys.Any(),
                    excludeUserIds: mentionedUserIds);

                // Send mention notifications for validated mentions
                if (mentionedUserIds.Any())
                {
                    await _eventNotificationService.SendPostMentionNotificationsAsync(
                        post.Id,
                        userId,
                        user.Name,
                        text,
                        mentionedUserIds);
                }
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
            dto.Mentions = validatedMentions;
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
