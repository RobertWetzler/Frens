using Cliq.Server.Data;
using Cliq.Server.Models;
using Cliq.Server.Utilities;
using Microsoft.EntityFrameworkCore;

namespace Cliq.Server.Services;

public interface IInterestService
{
    /// <summary>
    /// Search/suggest interests by name prefix. Returns interests sorted by how many of the user's friends use them.
    /// </summary>
    Task<List<InterestSuggestionDto>> SearchInterestsAsync(Guid userId, string query, int limit = 10);

    /// <summary>
    /// Get interests that are popular among the user's friends.
    /// </summary>
    Task<List<InterestSuggestionDto>> GetPopularInterestsAsync(Guid userId, int limit = 20);

    /// <summary>
    /// Get all interests the user currently follows.
    /// </summary>
    Task<List<InterestDto>> GetUserInterestsAsync(Guid userId);

    /// <summary>
    /// Get interests visible on a user's profile (interests they follow or post to).
    /// </summary>
    Task<List<InterestPublicDto>> GetUserProfileInterestsAsync(Guid userId);

    /// <summary>
    /// Follow an interest. Creates the interest if it doesn't exist yet.
    /// </summary>
    Task<InterestDto> FollowInterestAsync(Guid userId, string interestName, string? displayName = null);

    /// <summary>
    /// Unfollow an interest.
    /// </summary>
    Task UnfollowInterestAsync(Guid userId, string interestName);

    /// <summary>
    /// Update subscription settings for an interest (e.g., friends-of-friends toggle).
    /// </summary>
    Task<InterestDto> UpdateInterestSettingsAsync(Guid userId, string interestName, UpdateInterestSettingsRequest settings);

    /// <summary>
    /// Get or create an interest by normalized name. Used internally when creating posts.
    /// </summary>
    Task<Interest> GetOrCreateInterestAsync(string name, string displayName, Guid createdByUserId);

    /// <summary>
    /// Check if the user can announce a new interest (rate-limiting).
    /// </summary>
    Task<bool> CanAnnounceInterestAsync(Guid userId);

    /// <summary>
    /// Record that a user announced an interest.
    /// </summary>
    Task RecordAnnouncementAsync(Guid userId, Guid interestId);

    /// <summary>
    /// Get the user's followed interests as InterestPublicDto (lightweight, for create-post data).
    /// </summary>
    Task<List<InterestPublicDto>> GetUserFollowedInterestsPublicAsync(Guid userId);

    /// <summary>
    /// Get suggested interests for the create-post screen based on friends' usage.
    /// </summary>
    Task<List<InterestSuggestionDto>> GetSuggestedInterestsForPostAsync(Guid userId, int limit = 10);

    /// <summary>
    /// Get InterestPublicDto list for a set of post IDs (batch, for feed population).
    /// When viewerFollowedInterestIds is provided, only returns interests the viewer follows (privacy filter).
    /// </summary>
    Task<Dictionary<Guid, List<InterestPublicDto>>> GetInterestsForPostsAsync(IEnumerable<Guid> postIds, IEnumerable<Guid>? viewerFollowedInterestIds = null);

    /// <summary>
    /// Get interests recommended for the feed: popular among friends but not yet followed by the user.
    /// </summary>
    Task<List<InterestSuggestionDto>> GetRecommendedInterestsForFeedAsync(Guid userId, int limit = 5);
}

public class InterestService : IInterestService
{
    private readonly CliqDbContext _dbContext;
    private readonly IFriendshipService _friendshipService;
    private readonly ILogger<InterestService> _logger;

    /// <summary>
    /// Maximum number of interest announcements per week.
    /// </summary>
    private const int MaxAnnouncementsPerWeek = 1;

    public InterestService(
        CliqDbContext dbContext,
        IFriendshipService friendshipService,
        ILogger<InterestService> logger)
    {
        _dbContext = dbContext;
        _friendshipService = friendshipService;
        _logger = logger;
    }

    public async Task<List<InterestSuggestionDto>> SearchInterestsAsync(Guid userId, string query, int limit = 10)
    {
        var normalizedQuery = InterestNameHelper.Normalize(query);
        if (string.IsNullOrEmpty(normalizedQuery))
            return new List<InterestSuggestionDto>();

        var friendIds = await GetFriendIdsAsync(userId);

        var results = await _dbContext.Interests
            .Where(i => i.Name.StartsWith(normalizedQuery))
            .Select(i => new InterestSuggestionDto
            {
                Id = i.Id,
                Name = i.Name,
                DisplayName = i.DisplayName,
                FriendsUsingCount = i.Subscribers.Count(s => friendIds.Contains(s.UserId))
            })
            .OrderByDescending(i => i.FriendsUsingCount)
            .ThenBy(i => i.Name)
            .Take(limit)
            .ToListAsync();

        return results;
    }

    public async Task<List<InterestSuggestionDto>> GetPopularInterestsAsync(Guid userId, int limit = 20)
    {
        var friendIds = await GetFriendIdsAsync(userId);

        // Get interests that friends use, ranked by how many friends use them
        var popular = await _dbContext.InterestSubscriptions
            .Where(s => friendIds.Contains(s.UserId))
            .GroupBy(s => s.InterestId)
            .Select(g => new
            {
                InterestId = g.Key,
                FriendsUsingCount = g.Count()
            })
            .OrderByDescending(g => g.FriendsUsingCount)
            .Take(limit)
            .Join(_dbContext.Interests, g => g.InterestId, i => i.Id, (g, i) => new InterestSuggestionDto
            {
                Id = i.Id,
                Name = i.Name,
                DisplayName = i.DisplayName,
                FriendsUsingCount = g.FriendsUsingCount
            })
            .ToListAsync();

        return popular;
    }

    public async Task<List<InterestDto>> GetUserInterestsAsync(Guid userId)
    {
        var friendIds = await GetFriendIdsAsync(userId);

        var interests = await _dbContext.InterestSubscriptions
            .Where(s => s.UserId == userId)
            .Include(s => s.Interest)
            .Select(s => new InterestDto
            {
                Id = s.Interest!.Id,
                Name = s.Interest.Name,
                DisplayName = s.Interest.DisplayName,
                IsFollowing = true,
                IncludeFriendsOfFriends = s.IncludeFriendsOfFriends,
                FriendsFollowingCount = s.Interest.Subscribers.Count(sub => friendIds.Contains(sub.UserId) && sub.UserId != userId)
            })
            .OrderBy(i => i.DisplayName)
            .ToListAsync();

        return interests;
    }

    public async Task<List<InterestPublicDto>> GetUserProfileInterestsAsync(Guid userId)
    {
        return await _dbContext.InterestSubscriptions
            .Where(s => s.UserId == userId)
            .Include(s => s.Interest)
            .Select(s => new InterestPublicDto
            {
                Id = s.Interest!.Id,
                Name = s.Interest.Name,
                DisplayName = s.Interest.DisplayName
            })
            .OrderBy(i => i.DisplayName)
            .ToListAsync();
    }

    public async Task<InterestDto> FollowInterestAsync(Guid userId, string interestName, string? displayName = null)
    {
        var (normalizedName, derivedDisplayName, error) = InterestNameHelper.NormalizeAndValidate(interestName);
        if (error != null)
            throw new BadHttpRequestException(error);

        var finalDisplayName = !string.IsNullOrWhiteSpace(displayName)
            ? InterestNameHelper.CreateDisplayName(displayName)
            : derivedDisplayName;

        var interest = await GetOrCreateInterestAsync(normalizedName, finalDisplayName, userId);

        // Check if already following
        var existing = await _dbContext.InterestSubscriptions
            .FirstOrDefaultAsync(s => s.InterestId == interest.Id && s.UserId == userId);

        if (existing != null)
        {
            // Already following, return current state
            var friendIds = await GetFriendIdsAsync(userId);
            var friendCount = await _dbContext.InterestSubscriptions
                .CountAsync(s => s.InterestId == interest.Id && friendIds.Contains(s.UserId) && s.UserId != userId);

            return new InterestDto
            {
                Id = interest.Id,
                Name = interest.Name,
                DisplayName = interest.DisplayName,
                IsFollowing = true,
                IncludeFriendsOfFriends = existing.IncludeFriendsOfFriends,
                FriendsFollowingCount = friendCount
            };
        }

        // Create subscription
        var subscription = new InterestSubscription
        {
            InterestId = interest.Id,
            UserId = userId,
            SubscribedAt = DateTime.UtcNow,
            IncludeFriendsOfFriends = false
        };

        await _dbContext.InterestSubscriptions.AddAsync(subscription);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("User {UserId} followed interest {InterestName}", userId, normalizedName);

        var friendIdsForCount = await GetFriendIdsAsync(userId);
        var friendsFollowing = await _dbContext.InterestSubscriptions
            .CountAsync(s => s.InterestId == interest.Id && friendIdsForCount.Contains(s.UserId) && s.UserId != userId);

        return new InterestDto
        {
            Id = interest.Id,
            Name = interest.Name,
            DisplayName = interest.DisplayName,
            IsFollowing = true,
            IncludeFriendsOfFriends = false,
            FriendsFollowingCount = friendsFollowing
        };
    }

    public async Task UnfollowInterestAsync(Guid userId, string interestName)
    {
        var normalizedName = InterestNameHelper.Normalize(interestName);

        var interest = await _dbContext.Interests
            .FirstOrDefaultAsync(i => i.Name == normalizedName);

        if (interest == null)
            throw new BadHttpRequestException($"Interest '{interestName}' not found.");

        var subscription = await _dbContext.InterestSubscriptions
            .FirstOrDefaultAsync(s => s.InterestId == interest.Id && s.UserId == userId);

        if (subscription == null)
            return; // Not following, nothing to do

        _dbContext.InterestSubscriptions.Remove(subscription);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("User {UserId} unfollowed interest {InterestName}", userId, normalizedName);
    }

    public async Task<InterestDto> UpdateInterestSettingsAsync(Guid userId, string interestName, UpdateInterestSettingsRequest settings)
    {
        var normalizedName = InterestNameHelper.Normalize(interestName);

        var subscription = await _dbContext.InterestSubscriptions
            .Include(s => s.Interest)
            .FirstOrDefaultAsync(s => s.Interest!.Name == normalizedName && s.UserId == userId);

        if (subscription == null)
            throw new BadHttpRequestException($"You are not following interest '{interestName}'.");

        subscription.IncludeFriendsOfFriends = settings.IncludeFriendsOfFriends;
        await _dbContext.SaveChangesAsync();

        var friendIds = await GetFriendIdsAsync(userId);
        var friendsFollowing = await _dbContext.InterestSubscriptions
            .CountAsync(s => s.InterestId == subscription.InterestId && friendIds.Contains(s.UserId) && s.UserId != userId);

        return new InterestDto
        {
            Id = subscription.Interest!.Id,
            Name = subscription.Interest.Name,
            DisplayName = subscription.Interest.DisplayName,
            IsFollowing = true,
            IncludeFriendsOfFriends = subscription.IncludeFriendsOfFriends,
            FriendsFollowingCount = friendsFollowing
        };
    }

    public async Task<Interest> GetOrCreateInterestAsync(string name, string displayName, Guid createdByUserId)
    {
        var normalizedName = InterestNameHelper.Normalize(name);

        var existing = await _dbContext.Interests
            .FirstOrDefaultAsync(i => i.Name == normalizedName);

        if (existing != null)
            return existing;

        var interest = new Interest
        {
            Id = Guid.NewGuid(),
            Name = normalizedName,
            DisplayName = displayName,
            CreatedAt = DateTime.UtcNow,
            CreatedByUserId = createdByUserId
        };

        await _dbContext.Interests.AddAsync(interest);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Interest '{InterestName}' created by user {UserId}", normalizedName, createdByUserId);

        return interest;
    }

    public async Task<bool> CanAnnounceInterestAsync(Guid userId)
    {
        var oneWeekAgo = DateTime.UtcNow.AddDays(-7);
        var recentAnnouncements = await _dbContext.InterestAnnouncements
            .CountAsync(a => a.UserId == userId && a.AnnouncedAt >= oneWeekAgo);

        return recentAnnouncements < MaxAnnouncementsPerWeek;
    }

    public async Task RecordAnnouncementAsync(Guid userId, Guid interestId)
    {
        var announcement = new InterestAnnouncement
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            InterestId = interestId,
            AnnouncedAt = DateTime.UtcNow
        };

        await _dbContext.InterestAnnouncements.AddAsync(announcement);
        await _dbContext.SaveChangesAsync();
    }

    public async Task<List<InterestPublicDto>> GetUserFollowedInterestsPublicAsync(Guid userId)
    {
        return await _dbContext.InterestSubscriptions
            .Where(s => s.UserId == userId)
            .Include(s => s.Interest)
            .Select(s => new InterestPublicDto
            {
                Id = s.Interest!.Id,
                Name = s.Interest.Name,
                DisplayName = s.Interest.DisplayName
            })
            .OrderBy(i => i.DisplayName)
            .ToListAsync();
    }

    public async Task<List<InterestSuggestionDto>> GetSuggestedInterestsForPostAsync(Guid userId, int limit = 10)
    {
        var friendIds = await GetFriendIdsAsync(userId);

        // Get interests used by friends that the user doesn't already follow
        var userInterestIds = await _dbContext.InterestSubscriptions
            .Where(s => s.UserId == userId)
            .Select(s => s.InterestId)
            .ToListAsync();

        return await _dbContext.InterestSubscriptions
            .Where(s => friendIds.Contains(s.UserId) && !userInterestIds.Contains(s.InterestId))
            .GroupBy(s => s.InterestId)
            .Select(g => new
            {
                InterestId = g.Key,
                FriendsUsingCount = g.Count()
            })
            .OrderByDescending(g => g.FriendsUsingCount)
            .Take(limit)
            .Join(_dbContext.Interests, g => g.InterestId, i => i.Id, (g, i) => new InterestSuggestionDto
            {
                Id = i.Id,
                Name = i.Name,
                DisplayName = i.DisplayName,
                FriendsUsingCount = g.FriendsUsingCount
            })
            .ToListAsync();
    }

    public async Task<Dictionary<Guid, List<InterestPublicDto>>> GetInterestsForPostsAsync(IEnumerable<Guid> postIds, IEnumerable<Guid>? viewerFollowedInterestIds = null)
    {
        var postIdList = postIds.ToList();
        if (!postIdList.Any())
            return new Dictionary<Guid, List<InterestPublicDto>>();

        var query = _dbContext.InterestPosts
            .Where(ip => postIdList.Contains(ip.PostId));

        // Privacy filter: only show interests the viewer follows
        if (viewerFollowedInterestIds != null)
        {
            var followedIds = viewerFollowedInterestIds.ToList();
            query = query.Where(ip => followedIds.Contains(ip.InterestId));
        }

        var interestInfo = await query
            .Include(ip => ip.Interest)
            .Select(ip => new
            {
                ip.PostId,
                Interest = new InterestPublicDto
                {
                    Id = ip.Interest!.Id,
                    Name = ip.Interest.Name,
                    DisplayName = ip.Interest.DisplayName
                }
            })
            .ToListAsync();

        return interestInfo
            .GroupBy(i => i.PostId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Interest).ToList());
    }

    public async Task<List<InterestSuggestionDto>> GetRecommendedInterestsForFeedAsync(Guid userId, int limit = 5)
    {
        var friendIds = await GetFriendIdsAsync(userId);

        // Get IDs of interests the user already follows
        var userInterestIds = await _dbContext.InterestSubscriptions
            .Where(s => s.UserId == userId)
            .Select(s => s.InterestId)
            .ToListAsync();

        // Find interests that multiple friends post to, but the user doesn't follow yet
        return await _dbContext.InterestPosts
            .Where(ip => friendIds.Contains(ip.Post!.UserId))
            .Where(ip => !userInterestIds.Contains(ip.InterestId))
            .GroupBy(ip => ip.InterestId)
            .Select(g => new
            {
                InterestId = g.Key,
                FriendPostCount = g.Select(ip => ip.Post!.UserId).Distinct().Count()
            })
            .Where(g => g.FriendPostCount >= 2) // At least 2 friends post to it
            .OrderByDescending(g => g.FriendPostCount)
            .Take(limit)
            .Join(_dbContext.Interests, g => g.InterestId, i => i.Id, (g, i) => new InterestSuggestionDto
            {
                Id = i.Id,
                Name = i.Name,
                DisplayName = i.DisplayName,
                FriendsUsingCount = g.FriendPostCount
            })
            .ToListAsync();
    }

    /// <summary>
    /// Helper to get the IDs of a user's accepted friends.
    /// </summary>
    private async Task<List<Guid>> GetFriendIdsAsync(Guid userId)
    {
        var friends = await _friendshipService.GetFriendsAsync(userId);
        return friends.Select(f => f.Id).ToList();
    }
}

// Extension method for dependency injection
public static class InterestServiceExtensions
{
    public static IServiceCollection AddInterestServices(this IServiceCollection services)
    {
        services.AddScoped<IInterestService, InterestService>();
        return services;
    }
}
