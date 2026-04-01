using Cliq.Server.Data;
using Cliq.Server.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;

namespace Cliq.Server.Services;

public sealed class AprilFoolsAliasIdentity
{
    public required Guid SourceUserId { get; init; }
    public required Guid TargetUserId { get; init; }
    public required string TargetName { get; init; }
    public string? TargetProfilePictureUrl { get; init; }
}

public interface IAprilFoolsIdentityService
{
    bool IsActive(DateTime utcNow);
    bool IsContentDuringPrank(DateTime contentDateUtc);
    Task<AprilFoolsAliasIdentity?> GetAliasIdentityAsync(Guid sourceUserId);
    Task<string> GetAliasNameAsync(Guid sourceUserId, string realName);
    Task<string> GetAliasNameAsync(Guid sourceUserId, string realName, DateTime contentDateUtc);
    Task ApplyAliasAsync(UserDto userDto);
    Task ApplyAliasAsync(UserDto userDto, DateTime contentDateUtc);
    Task ApplyAliasAsync(UserProfileDto userProfileDto);
    Task ApplyAliasAsync(MentionableUserDto mentionableUserDto);
}

public sealed class AprilFoolsIdentityService : IAprilFoolsIdentityService
{
    private static readonly SemaphoreSlim CacheLock = new(1, 1);

    private static DateOnly? _cachedDate;
    private static Dictionary<Guid, Guid> _sourceToTargetMap = new();
    private static Dictionary<Guid, UserIdentitySnapshot> _targetSnapshots = new();

    private readonly CliqDbContext _dbContext;
    private readonly IObjectStorageService _storage;
    private readonly ITimeProviderService _timeProvider;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AprilFoolsIdentityService> _logger;

    private sealed class FriendshipPair
    {
        public Guid RequesterId { get; init; }
        public Guid AddresseeId { get; init; }
    }

    public AprilFoolsIdentityService(
        CliqDbContext dbContext,
        IObjectStorageService storage,
        ITimeProviderService timeProvider,
        IConfiguration configuration,
        ILogger<AprilFoolsIdentityService> logger)
    {
        _dbContext = dbContext;
        _storage = storage;
        _timeProvider = timeProvider;
        _configuration = configuration;
        _logger = logger;
    }

    public bool IsActive(DateTime utcNow)
    {
        if (IsForceDisabled())
        {
            return false;
        }

        if (IsForceEnabled())
        {
            return true;
        }

        return IsWithinWindow(utcNow);
    }

    public bool IsContentDuringPrank(DateTime contentDateUtc)
    {
        if (IsForceEnabled())
        {
            // In force-enabled mode, use a configurable cutoff so dev testing
            // can verify that old content keeps real names.
            var cutoff = _configuration["AprilFools:ForceContentCutoffUtc"];
            if (!string.IsNullOrWhiteSpace(cutoff) && DateTime.TryParse(cutoff, null,
                    System.Globalization.DateTimeStyles.AdjustToUniversal, out var cutoffUtc))
            {
                return contentDateUtc >= cutoffUtc;
            }
            return true; // no cutoff configured → swap everything
        }
        return IsWithinWindow(contentDateUtc);
    }

    /// <summary>
    /// Checks if a UTC timestamp falls within the configured activation window.
    /// Config keys: AprilFools:StartUtc / AprilFools:EndUtc (ISO 8601).
    /// Defaults: April 1 9am PST → April 3 12am PST.
    /// </summary>
    private bool IsWithinWindow(DateTime utcTime)
    {
        var startUtc = ParseConfigDateTime("AprilFools:StartUtc")
            ?? DefaultStartUtc(utcTime.Year);
        var endUtc = ParseConfigDateTime("AprilFools:EndUtc")
            ?? DefaultEndUtc(utcTime.Year);

        return utcTime >= startUtc && utcTime < endUtc;
    }

    private DateTime? ParseConfigDateTime(string key)
    {
        var raw = _configuration[key];
        if (!string.IsNullOrWhiteSpace(raw) && DateTime.TryParse(raw, null,
                System.Globalization.DateTimeStyles.AdjustToUniversal, out var dt))
        {
            return dt;
        }
        return null;
    }

    /// <summary>Default start: April 1 8am PST = April 1 3pm UTC.</summary>
    private static DateTime DefaultStartUtc(int year) =>
        new(year, 4, 1, 15, 0, 0, DateTimeKind.Utc);

    /// <summary>Default end: April 2 9pm PST = April 3 4am UTC.</summary>
    private static DateTime DefaultEndUtc(int year) =>
        new(year, 4, 3, 4, 0, 0, DateTimeKind.Utc);

    private bool IsForceDisabled()
    {
        var raw = _configuration["APRIL_FOOLS_FORCE_DISABLED"];
        if (string.IsNullOrWhiteSpace(raw))
        {
            raw = _configuration["AprilFools:ForceDisabled"];
        }

        return bool.TryParse(raw, out var parsed) && parsed;
    }

    private bool IsForceEnabled()
    {
        var raw = _configuration["APRIL_FOOLS_FORCE_ENABLED"];
        if (string.IsNullOrWhiteSpace(raw))
        {
            raw = _configuration["AprilFools:ForceEnabled"];
        }

        return bool.TryParse(raw, out var parsed) && parsed;
    }

    public async Task<string> GetAliasNameAsync(Guid sourceUserId, string realName)
    {
        var alias = await GetAliasIdentityAsync(sourceUserId);
        return alias?.TargetName ?? realName;
    }

    public async Task<string> GetAliasNameAsync(Guid sourceUserId, string realName, DateTime contentDateUtc)
    {
        if (!IsContentDuringPrank(contentDateUtc)) return realName;
        return await GetAliasNameAsync(sourceUserId, realName);
    }

    public async Task<AprilFoolsAliasIdentity?> GetAliasIdentityAsync(Guid sourceUserId)
    {
        var now = _timeProvider.UtcNow;
        if (!IsActive(now))
        {
            return null;
        }

        var today = DateOnly.FromDateTime(now);
        await EnsureDailyCacheAsync(today, now);

        if (!_sourceToTargetMap.TryGetValue(sourceUserId, out var targetUserId))
        {
            return null;
        }

        if (!_targetSnapshots.TryGetValue(targetUserId, out var targetSnapshot))
        {
            return null;
        }

        return new AprilFoolsAliasIdentity
        {
            SourceUserId = sourceUserId,
            TargetUserId = targetUserId,
            TargetName = targetSnapshot.Name,
            TargetProfilePictureUrl = string.IsNullOrEmpty(targetSnapshot.ProfilePictureKey)
                ? null
                : _storage.GetProfilePictureUrl(targetSnapshot.ProfilePictureKey)
        };
    }

    public async Task ApplyAliasAsync(UserDto userDto)
    {
        var alias = await GetAliasIdentityAsync(userDto.Id);
        if (alias == null)
        {
            return;
        }

        userDto.Name = alias.TargetName;
        userDto.ProfilePictureUrl = alias.TargetProfilePictureUrl;
    }

    public async Task ApplyAliasAsync(UserDto userDto, DateTime contentDateUtc)
    {
        if (!IsContentDuringPrank(contentDateUtc)) return;
        await ApplyAliasAsync(userDto);
    }

    public async Task ApplyAliasAsync(UserProfileDto userProfileDto)
    {
        var alias = await GetAliasIdentityAsync(userProfileDto.Id);
        if (alias == null)
        {
            return;
        }

        userProfileDto.Name = alias.TargetName;
        userProfileDto.ProfilePictureUrl = alias.TargetProfilePictureUrl;
    }

    public async Task ApplyAliasAsync(MentionableUserDto mentionableUserDto)
    {
        var alias = await GetAliasIdentityAsync(mentionableUserDto.Id);
        if (alias == null)
        {
            return;
        }

        mentionableUserDto.Name = alias.TargetName;
        mentionableUserDto.ProfilePictureUrl = alias.TargetProfilePictureUrl;
    }

    private async Task EnsureDailyCacheAsync(DateOnly today, DateTime nowUtc)
    {
        if (_cachedDate == today && _sourceToTargetMap.Count > 0)
        {
            return;
        }

        await CacheLock.WaitAsync();
        try
        {
            if (_cachedDate == today && _sourceToTargetMap.Count > 0)
            {
                return;
            }

            var stopwatch = System.Diagnostics.Stopwatch.StartNew();
            var map = await BuildDailyMappingAsync(nowUtc);
            var targetIds = map.Values.Distinct().ToList();

            var targets = await _dbContext.Users
                .Where(u => targetIds.Contains(u.Id))
                .Select(u => new UserIdentitySnapshot
                {
                    Id = u.Id,
                    Name = u.Name,
                    ProfilePictureKey = u.ProfilePictureKey
                })
                .ToListAsync();

            _sourceToTargetMap = map;
            _targetSnapshots = targets.ToDictionary(t => t.Id, t => t);

            // Apply hardcoded overrides
            await ApplyMappingOverridesAsync(map);

            _cachedDate = today;

            stopwatch.Stop();
            _logger.LogInformation(
                "April Fools mapping generated for {Date}. Sources={SourceCount}, Targets={TargetCount}, ElapsedMs={ElapsedMs}",
                today,
                _sourceToTargetMap.Count,
                _targetSnapshots.Count,
                stopwatch.ElapsedMilliseconds);
        }
        finally
        {
            CacheLock.Release();
        }
    }

    /// <summary>
    /// Hardcoded swap overrides for specific users.
    /// </summary>
    private static readonly (string SourceName, string TargetName)[] MappingOverrides =
    {
        ("Robert Wetzler", "Sierra Takushi"),
    };

    private async Task ApplyMappingOverridesAsync(Dictionary<Guid, Guid> map)
    {
        foreach (var (sourceName, targetName) in MappingOverrides)
        {
            var source = await _dbContext.Users.AsNoTracking()
                .Where(u => u.Name == sourceName)
                .Select(u => new { u.Id, u.Name, u.ProfilePictureKey })
                .FirstOrDefaultAsync();
            var target = await _dbContext.Users.AsNoTracking()
                .Where(u => u.Name == targetName)
                .Select(u => new { u.Id, u.Name, u.ProfilePictureKey })
                .FirstOrDefaultAsync();

            if (source == null || target == null) continue;

            map[source.Id] = target.Id;
            _targetSnapshots[target.Id] = new UserIdentitySnapshot
            {
                Id = target.Id,
                Name = target.Name,
                ProfilePictureKey = target.ProfilePictureKey,
            };
        }
    }

    private async Task<Dictionary<Guid, Guid>> BuildDailyMappingAsync(DateTime nowUtc)
    {
        var since = nowUtc.AddDays(-30);

        var friendships = await _dbContext.Friendships
            .Where(f => f.Status == FriendshipStatus.Accepted)
            .Select(f => new FriendshipPair { RequesterId = f.RequesterId, AddresseeId = f.AddresseeId })
            .AsNoTracking()
            .ToListAsync();

        var friendsByUser = BuildFriendGraph(friendships);

        var directionalScores = new ConcurrentDictionary<(Guid Source, Guid Target), double>();

        // Small baseline score keeps deterministic output for users with no recent activity.
        foreach (var (sourceUserId, friendIds) in friendsByUser)
        {
            foreach (var friendId in friendIds)
            {
                directionalScores.TryAdd((sourceUserId, friendId), 1.0);
            }
        }

        await AddCommentOnPostScoresAsync(since, friendsByUser, directionalScores);
        await AddReplyScoresAsync(since, friendsByUser, directionalScores);
        await AddDirectShareScoresAsync(since, friendsByUser, directionalScores);

        var candidateRankings = BuildCandidateRankings(nowUtc, friendsByUser, directionalScores);
        return BuildOneToOneFirstMap(candidateRankings);
    }

    private static Dictionary<Guid, HashSet<Guid>> BuildFriendGraph(IEnumerable<FriendshipPair> friendships)
    {
        var graph = new Dictionary<Guid, HashSet<Guid>>();
        foreach (var friendship in friendships)
        {
            AddFriendEdge(graph, friendship.RequesterId, friendship.AddresseeId);
            AddFriendEdge(graph, friendship.AddresseeId, friendship.RequesterId);
        }

        return graph;
    }

    private static void AddFriendEdge(Dictionary<Guid, HashSet<Guid>> graph, Guid a, Guid b)
    {
        if (!graph.TryGetValue(a, out var friends))
        {
            friends = new HashSet<Guid>();
            graph[a] = friends;
        }

        if (a != b)
        {
            friends.Add(b);
        }
    }

    private async Task AddCommentOnPostScoresAsync(
        DateTime since,
        Dictionary<Guid, HashSet<Guid>> friendsByUser,
        ConcurrentDictionary<(Guid Source, Guid Target), double> scores)
    {
        var interactions = await _dbContext.Comments
            .Where(c => c.Date >= since)
            .Join(
                _dbContext.Posts,
                c => c.PostId,
                p => p.Id,
                (c, p) => new { Source = c.UserId, Target = p.UserId })
            .Where(x => x.Source != x.Target)
            .AsNoTracking()
            .ToListAsync();

        foreach (var interaction in interactions)
        {
            if (friendsByUser.TryGetValue(interaction.Source, out var friends) && friends.Contains(interaction.Target))
            {
                scores.AddOrUpdate((interaction.Source, interaction.Target), 3.0, (_, current) => current + 3.0);
            }
        }
    }

    private async Task AddReplyScoresAsync(
        DateTime since,
        Dictionary<Guid, HashSet<Guid>> friendsByUser,
        ConcurrentDictionary<(Guid Source, Guid Target), double> scores)
    {
        var interactions = await _dbContext.Comments
            .Where(c => c.Date >= since && c.ParentCommentId != null)
            .Join(
                _dbContext.Comments,
                c => c.ParentCommentId,
                parent => parent.Id,
                (c, parent) => new { Source = c.UserId, Target = parent.UserId })
            .Where(x => x.Source != x.Target)
            .AsNoTracking()
            .ToListAsync();

        foreach (var interaction in interactions)
        {
            if (friendsByUser.TryGetValue(interaction.Source, out var friends) && friends.Contains(interaction.Target))
            {
                scores.AddOrUpdate((interaction.Source, interaction.Target), 4.0, (_, current) => current + 4.0);
            }
        }
    }

    private async Task AddDirectShareScoresAsync(
        DateTime since,
        Dictionary<Guid, HashSet<Guid>> friendsByUser,
        ConcurrentDictionary<(Guid Source, Guid Target), double> scores)
    {
        var interactions = await _dbContext.IndividualPosts
            .Where(ip => ip.SharedAt >= since)
            .Join(
                _dbContext.Posts,
                ip => ip.PostId,
                p => p.Id,
                (ip, p) => new { Source = p.UserId, Target = ip.UserId })
            .Where(x => x.Source != x.Target)
            .AsNoTracking()
            .ToListAsync();

        foreach (var interaction in interactions)
        {
            if (friendsByUser.TryGetValue(interaction.Source, out var friends) && friends.Contains(interaction.Target))
            {
                scores.AddOrUpdate((interaction.Source, interaction.Target), 5.0, (_, current) => current + 5.0);
            }
        }
    }

    private static Dictionary<Guid, List<Guid>> BuildCandidateRankings(
        DateTime nowUtc,
        Dictionary<Guid, HashSet<Guid>> friendsByUser,
        ConcurrentDictionary<(Guid Source, Guid Target), double> scores)
    {
        var day = DateOnly.FromDateTime(nowUtc);
        var rankings = new Dictionary<Guid, List<Guid>>();

        foreach (var (sourceUserId, friendIds) in friendsByUser)
        {
            var orderedFriends = friendIds
                .OrderByDescending(friendId => scores.TryGetValue((sourceUserId, friendId), out var score) ? score : 0.0)
                .ThenBy(friendId => ComputeStableTieBreaker(day, sourceUserId, friendId))
                .ToList();

            if (orderedFriends.Count > 0)
            {
                rankings[sourceUserId] = orderedFriends;
            }
        }

        return rankings;
    }

    private static Dictionary<Guid, Guid> BuildOneToOneFirstMap(Dictionary<Guid, List<Guid>> candidateRankings)
    {
        var map = new Dictionary<Guid, Guid>();
        var usedTargets = new HashSet<Guid>();

        var orderedSources = candidateRankings
            .OrderByDescending(kvp => kvp.Value.Count)
            .ThenBy(kvp => kvp.Key)
            .Select(kvp => kvp.Key)
            .ToList();

        // Pass 1: maximize one-to-one pairings.
        foreach (var sourceUserId in orderedSources)
        {
            var rankedCandidates = candidateRankings[sourceUserId];
            var candidate = rankedCandidates.FirstOrDefault(target => !usedTargets.Contains(target));
            if (candidate == Guid.Empty)
            {
                continue;
            }

            map[sourceUserId] = candidate;
            usedTargets.Add(candidate);
        }

        // Pass 2: users left out of strict matching map to their least-used friend
        // to spread duplicates evenly instead of everyone piling onto the most popular user.
        var targetUsageCounts = new Dictionary<Guid, int>();
        foreach (var target in map.Values)
        {
            targetUsageCounts[target] = targetUsageCounts.GetValueOrDefault(target) + 1;
        }

        foreach (var sourceUserId in orderedSources)
        {
            if (map.ContainsKey(sourceUserId))
            {
                continue;
            }

            var candidates = candidateRankings[sourceUserId];
            if (candidates.Count == 0)
            {
                continue;
            }

            // Pick the friend used the fewest times as a target, breaking ties by ranking order.
            var fallback = candidates
                .OrderBy(c => targetUsageCounts.GetValueOrDefault(c))
                .First();

            map[sourceUserId] = fallback;
            targetUsageCounts[fallback] = targetUsageCounts.GetValueOrDefault(fallback) + 1;
        }

        return map;
    }

    private static ulong ComputeStableTieBreaker(DateOnly day, Guid sourceUserId, Guid targetUserId)
    {
        var input = $"{day:yyyy-MM-dd}:{sourceUserId:D}:{targetUserId:D}";
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return BitConverter.ToUInt64(bytes, 0);
    }

    private sealed class UserIdentitySnapshot
    {
        public Guid Id { get; init; }
        public required string Name { get; init; }
        public string? ProfilePictureKey { get; init; }
    }
}

public static class AprilFoolsIdentityServiceExtensions
{
    public static IServiceCollection AddAprilFoolsIdentityServices(this IServiceCollection services)
    {
        services.AddScoped<ITimeProviderService, UtcTimeProviderService>();
        services.AddScoped<IAprilFoolsIdentityService, AprilFoolsIdentityService>();
        return services;
    }
}
