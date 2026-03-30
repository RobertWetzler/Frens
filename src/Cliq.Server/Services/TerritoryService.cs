using Cliq.Server.Data;
using Cliq.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace Cliq.Server.Services;

public interface ITerritoryService
{
    Task<TerritoryGameStateDto> GetGameStateAsync(Guid userId);
    Task<TerritoryPlayerDto> RegisterAsync(Guid userId, string color);
    Task<TerritoryCellDto> ClaimCellAsync(Guid userId, double latitude, double longitude);
    Task<List<TerritoryCellDto>> GetCellsInBoundsAsync(double southLat, double westLng, double northLat, double eastLng);
    Task<List<TerritoryLeaderboardEntryDto>> GetLeaderboardAsync(int top);
}

public class TerritoryService : ITerritoryService
{
    // Cell size must match the frontend constants exactly
    private const double CellSizeLat = 0.001369;
    private const double CellSizeLng = 0.001785;
    private const int CooldownSeconds = 120;

    /// <summary>
    /// Bucket size for spatial hashing. Each bucket covers BucketSize×BucketSize cells.
    /// With 500ft cells, a bucket of 32 covers ~3 miles per side — a good query granularity.
    /// </summary>
    private const int BucketSize = 32;

    private readonly CliqDbContext _db;
    private readonly ILogger<TerritoryService> _logger;

    public TerritoryService(CliqDbContext db, ILogger<TerritoryService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<TerritoryGameStateDto> GetGameStateAsync(Guid userId)
    {
        var player = await _db.TerritoryPlayers
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == userId);

        if (player == null)
        {
            return new TerritoryGameStateDto
            {
                IsRegistered = false,
                PlayerColor = null,
                LastClaimTime = null,
                CanClaim = false,
                CooldownSeconds = 0,
            };
        }

        var now = DateTime.UtcNow;
        var elapsed = player.LastClaimAt.HasValue
            ? (now - player.LastClaimAt.Value).TotalSeconds
            : double.MaxValue;
        var remaining = Math.Max(0, CooldownSeconds - elapsed);

        return new TerritoryGameStateDto
        {
            IsRegistered = true,
            PlayerColor = player.Color,
            LastClaimTime = player.LastClaimAt,
            CanClaim = remaining <= 0,
            CooldownSeconds = (int)Math.Ceiling(remaining),
        };
    }

    public async Task<TerritoryPlayerDto> RegisterAsync(Guid userId, string color)
    {
        // Prevent double registration
        var existing = await _db.TerritoryPlayers.FirstOrDefaultAsync(p => p.UserId == userId);
        if (existing != null)
            throw new InvalidOperationException("Already registered for Territory Wars");

        var user = await _db.Users.FindAsync(userId)
            ?? throw new InvalidOperationException("User not found");

        var player = new TerritoryPlayer
        {
            UserId = userId,
            Color = color,
        };
        _db.TerritoryPlayers.Add(player);
        await _db.SaveChangesAsync();

        return new TerritoryPlayerDto
        {
            UserId = userId,
            DisplayName = user.Name,
            Color = color,
        };
    }

    public async Task<TerritoryCellDto> ClaimCellAsync(Guid userId, double latitude, double longitude)
    {
        var player = await _db.TerritoryPlayers.FirstOrDefaultAsync(p => p.UserId == userId)
            ?? throw new InvalidOperationException("Not registered for Territory Wars");

        // Enforce cooldown
        if (player.LastClaimAt.HasValue)
        {
            var elapsed = (DateTime.UtcNow - player.LastClaimAt.Value).TotalSeconds;
            if (elapsed < CooldownSeconds)
                throw new InvalidOperationException($"Cooldown active. Wait {(int)Math.Ceiling(CooldownSeconds - elapsed)} seconds.");
        }

        var cellRow = (long)Math.Floor(latitude / CellSizeLat);
        var cellCol = (long)Math.Floor(longitude / CellSizeLng);
        var bucket = ComputeBucket(cellRow, cellCol);

        var user = await _db.Users.AsNoTracking().FirstAsync(u => u.Id == userId);

        // Upsert: overwrite existing claim on this cell (territory can be stolen)
        var existing = await _db.TerritoryClaims
            .FirstOrDefaultAsync(c => c.CellRow == cellRow && c.CellCol == cellCol);

        if (existing != null)
        {
            existing.ClaimedByUserId = userId;
            existing.Color = player.Color;
            existing.ClaimedAt = DateTime.UtcNow;
            existing.Bucket = bucket;
        }
        else
        {
            var claim = new TerritoryClaim
            {
                CellRow = cellRow,
                CellCol = cellCol,
                Bucket = bucket,
                ClaimedByUserId = userId,
                Color = player.Color,
            };
            _db.TerritoryClaims.Add(claim);
        }

        // Update last claim time
        player.LastClaimAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return new TerritoryCellDto
        {
            Row = cellRow,
            Col = cellCol,
            ClaimedBy = userId.ToString(),
            ClaimedByName = user.Name,
            Color = player.Color,
            ClaimedAt = DateTime.UtcNow,
        };
    }

    public async Task<List<TerritoryCellDto>> GetCellsInBoundsAsync(double southLat, double westLng, double northLat, double eastLng)
    {
        var minRow = (long)Math.Floor(southLat / CellSizeLat);
        var maxRow = (long)Math.Floor(northLat / CellSizeLat);
        var minCol = (long)Math.Floor(westLng / CellSizeLng);
        var maxCol = (long)Math.Floor(eastLng / CellSizeLng);

        var buckets = GetBucketsInRange(minRow, maxRow, minCol, maxCol);

        // Query by bucket first (indexed), then filter to exact range
        var claims = await _db.TerritoryClaims
            .AsNoTracking()
            .Include(c => c.ClaimedByUser)
            .Where(c => buckets.Contains(c.Bucket)
                && c.CellRow >= minRow && c.CellRow <= maxRow
                && c.CellCol >= minCol && c.CellCol <= maxCol)
            .Select(c => new TerritoryCellDto
            {
                Row = c.CellRow,
                Col = c.CellCol,
                ClaimedBy = c.ClaimedByUserId.ToString(),
                ClaimedByName = c.ClaimedByUser.Name,
                Color = c.Color,
                ClaimedAt = c.ClaimedAt,
            })
            .ToListAsync();

        return claims;
    }

    public async Task<List<TerritoryLeaderboardEntryDto>> GetLeaderboardAsync(int top = 20)
    {
        var leaderboard = await _db.TerritoryClaims
            .AsNoTracking()
            .GroupBy(c => c.ClaimedByUserId)
            .Select(g => new
            {
                UserId = g.Key,
                CellsClaimed = g.Count(),
                Color = g.OrderByDescending(c => c.ClaimedAt).First().Color,
            })
            .OrderByDescending(x => x.CellsClaimed)
            .Take(top)
            .ToListAsync();

        // Batch-load user names
        var userIds = leaderboard.Select(l => l.UserId).ToList();
        var userNames = await _db.Users
            .AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Name);

        return leaderboard.Select(l => new TerritoryLeaderboardEntryDto
        {
            UserId = l.UserId.ToString(),
            DisplayName = userNames.GetValueOrDefault(l.UserId, "Unknown"),
            Color = l.Color,
            CellsClaimed = l.CellsClaimed,
        }).ToList();
    }

    // ─── Spatial hashing helpers ───

    private static string ComputeBucket(long cellRow, long cellCol)
    {
        // Use integer division (floor toward negative infinity for negative coords)
        var bucketRow = cellRow >= 0 ? cellRow / BucketSize : (cellRow - BucketSize + 1) / BucketSize;
        var bucketCol = cellCol >= 0 ? cellCol / BucketSize : (cellCol - BucketSize + 1) / BucketSize;
        return $"{bucketRow}:{bucketCol}";
    }

    private static HashSet<string> GetBucketsInRange(long minRow, long maxRow, long minCol, long maxCol)
    {
        var minBucketRow = minRow >= 0 ? minRow / BucketSize : (minRow - BucketSize + 1) / BucketSize;
        var maxBucketRow = maxRow >= 0 ? maxRow / BucketSize : (maxRow - BucketSize + 1) / BucketSize;
        var minBucketCol = minCol >= 0 ? minCol / BucketSize : (minCol - BucketSize + 1) / BucketSize;
        var maxBucketCol = maxCol >= 0 ? maxCol / BucketSize : (maxCol - BucketSize + 1) / BucketSize;

        var buckets = new HashSet<string>();
        for (var r = minBucketRow; r <= maxBucketRow; r++)
        {
            for (var c = minBucketCol; c <= maxBucketCol; c++)
            {
                buckets.Add($"{r}:{c}");
            }
        }
        return buckets;
    }
}

// ─── DTOs ───

public class TerritoryGameStateDto
{
    public bool IsRegistered { get; set; }
    public string? PlayerColor { get; set; }
    public DateTime? LastClaimTime { get; set; }
    public bool CanClaim { get; set; }
    public int CooldownSeconds { get; set; }
}

public class TerritoryPlayerDto
{
    public Guid UserId { get; set; }
    public required string DisplayName { get; set; }
    public required string Color { get; set; }
}

public class TerritoryCellDto
{
    public long Row { get; set; }
    public long Col { get; set; }
    public string? ClaimedBy { get; set; }
    public string? ClaimedByName { get; set; }
    public string? Color { get; set; }
    public DateTime? ClaimedAt { get; set; }
}

public class TerritoryLeaderboardEntryDto
{
    public required string UserId { get; set; }
    public required string DisplayName { get; set; }
    public required string Color { get; set; }
    public int CellsClaimed { get; set; }
}

// ─── Request DTOs ───

public class TerritoryRegisterRequest
{
    public required string Color { get; set; }
}

public class TerritoryClaimRequest
{
    public double Latitude { get; set; }
    public double Longitude { get; set; }
}

public class TerritoryNearbyCellsRequest
{
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public int Radius { get; set; } = 8;
}

// ─── DI Extension ───

public static class TerritoryServiceExtensions
{
    public static IServiceCollection AddTerritoryServices(this IServiceCollection services)
    {
        services.AddScoped<ITerritoryService, TerritoryService>();
        return services;
    }
}
