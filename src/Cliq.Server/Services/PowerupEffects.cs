using Cliq.Server.Data;
using Cliq.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace Cliq.Server.Services;

public interface IPowerupService
{
    Task<List<PowerupLocationDto>> GetPowerupsInBoundsAsync(double south, double west, double north, double east);
    Task<PowerupClaimResultDto> ClaimPowerupAsync(Guid userId, double latitude, double longitude);
    Task<List<PowerupInventoryItemDto>> GetInventoryAsync(Guid userId);
    Task<PowerupUseResultDto> UsePowerupAsync(Guid userId, Guid powerupClaimId, double latitude, double longitude);
}

public class PowerupService : IPowerupService
{
    private const double CellSizeLat = 0.001369;
    private const double CellSizeLng = 0.001785;

    private readonly CliqDbContext _db;
    private readonly ICityLookupService _cityLookup;
    private readonly IConfiguration _configuration;
    private readonly ILogger<PowerupService> _logger;

    public PowerupService(CliqDbContext db, ICityLookupService cityLookup, IConfiguration configuration, ILogger<PowerupService> logger)
    {
        _db = db;
        _cityLookup = cityLookup;
        _configuration = configuration;
        _logger = logger;
    }

    private DateTime GetGameStartUtc()
    {
        var raw = _configuration["TerritoryGame:StartUtc"];
        if (!string.IsNullOrWhiteSpace(raw) && DateTime.TryParse(raw, null,
                System.Globalization.DateTimeStyles.AdjustToUniversal, out var dt))
            return dt;
        return new DateTime(2026, 4, 3, 14, 0, 0, DateTimeKind.Utc);
    }

    public async Task<List<PowerupLocationDto>> GetPowerupsInBoundsAsync(
        double south, double west, double north, double east)
    {
        var minRow = (long)Math.Floor(south / CellSizeLat);
        var maxRow = (long)Math.Floor(north / CellSizeLat);
        var minCol = (long)Math.Floor(west / CellSizeLng);
        var maxCol = (long)Math.Floor(east / CellSizeLng);

        var dateKey = PowerupSpawner.GetTodayDateKey();
        var spawns = PowerupSpawner.GetPowerupsInBounds(minRow, maxRow, minCol, maxCol, dateKey, GetGameStartUtc());

        if (spawns.Count == 0) return new();

        // Find which ones have already been claimed today
        var spawnCells = spawns.Select(s => new { s.CellRow, s.CellCol }).ToList();
        var claimedCells = await _db.PowerupClaims
            .AsNoTracking()
            .Where(pc => pc.DateKey == dateKey)
            .Select(pc => new { pc.CellRow, pc.CellCol })
            .ToListAsync();

        var claimedSet = claimedCells.ToHashSet();

        return spawns
            .Where(s => !claimedSet.Contains(new { s.CellRow, s.CellCol }))
            .Select(s =>
            {
                var def = PowerupRegistry.Get(s.PowerupType);
                return new PowerupLocationDto
                {
                    CellRow = s.CellRow,
                    CellCol = s.CellCol,
                    PowerupType = s.PowerupType,
                    Name = def?.Name ?? s.PowerupType,
                    Emoji = def?.Emoji ?? "❓",
                };
            })
            .ToList();
    }

    public async Task<PowerupClaimResultDto> ClaimPowerupAsync(Guid userId, double latitude, double longitude)
    {
        var cellRow = (long)Math.Floor(latitude / CellSizeLat);
        var cellCol = (long)Math.Floor(longitude / CellSizeLng);
        var dateKey = PowerupSpawner.GetTodayDateKey();

        // Verify a powerup exists at this cell today
        var spawn = PowerupSpawner.GetPowerupAtCell(cellRow, cellCol, dateKey, GetGameStartUtc())
            ?? throw new InvalidOperationException("No powerup at this location today.");

        // Check if already claimed by anyone
        var alreadyClaimed = await _db.PowerupClaims
            .AnyAsync(pc => pc.CellRow == cellRow && pc.CellCol == cellCol && pc.DateKey == dateKey);
        if (alreadyClaimed)
            throw new InvalidOperationException("This powerup has already been claimed.");

        var claim = new PowerupClaim
        {
            UserId = userId,
            CellRow = cellRow,
            CellCol = cellCol,
            PowerupType = spawn.PowerupType,
            DateKey = dateKey,
        };
        _db.PowerupClaims.Add(claim);
        await _db.SaveChangesAsync();

        var def = PowerupRegistry.Get(spawn.PowerupType);
        return new PowerupClaimResultDto
        {
            ClaimId = claim.Id,
            PowerupType = spawn.PowerupType,
            Name = def?.Name ?? spawn.PowerupType,
            Description = def?.Description ?? "",
            Emoji = def?.Emoji ?? "❓",
        };
    }

    public async Task<List<PowerupInventoryItemDto>> GetInventoryAsync(Guid userId)
    {
        var items = await _db.PowerupClaims
            .AsNoTracking()
            .Where(pc => pc.UserId == userId && pc.UsedAt == null)
            .OrderByDescending(pc => pc.ClaimedAt)
            .ToListAsync();

        return items.Select(pc =>
        {
            var def = PowerupRegistry.Get(pc.PowerupType);
            return new PowerupInventoryItemDto
            {
                ClaimId = pc.Id,
                PowerupType = pc.PowerupType,
                Name = def?.Name ?? pc.PowerupType,
                Description = def?.Description ?? "",
                Emoji = def?.Emoji ?? "❓",
                ClaimedAt = pc.ClaimedAt,
            };
        }).ToList();
    }

    public async Task<PowerupUseResultDto> UsePowerupAsync(
        Guid userId, Guid powerupClaimId, double latitude, double longitude)
    {
        var claim = await _db.PowerupClaims
            .FirstOrDefaultAsync(pc => pc.Id == powerupClaimId && pc.UserId == userId)
            ?? throw new InvalidOperationException("Powerup not found in your inventory.");

        if (claim.UsedAt.HasValue)
            throw new InvalidOperationException("This powerup has already been used.");

        var player = await _db.TerritoryPlayers.FirstOrDefaultAsync(p => p.UserId == userId)
            ?? throw new InvalidOperationException("Not registered for FrenZones.");

        // Execute the powerup effect
        var result = claim.PowerupType switch
        {
            "blast" => await ExecuteBlastAsync(userId, player.Color, latitude, longitude),
            _ => throw new InvalidOperationException($"Unknown powerup type: {claim.PowerupType}"),
        };

        claim.UsedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return result;
    }

    // ─── Powerup Effects ───

    private async Task<PowerupUseResultDto> ExecuteBlastAsync(
        Guid userId, string color, double latitude, double longitude)
    {
        var centerRow = (long)Math.Floor(latitude / CellSizeLat);
        var centerCol = (long)Math.Floor(longitude / CellSizeLng);
        const int radius = 2; // 5×5 = radius 2 from center

        var user = await _db.Users.AsNoTracking().FirstAsync(u => u.Id == userId);
        var cellsAffected = 0;

        for (var dr = -radius; dr <= radius; dr++)
        {
            for (var dc = -radius; dc <= radius; dc++)
            {
                var row = centerRow + dr;
                var col = centerCol + dc;
                var bucketRow = row >= 0 ? row / 32 : (row - 31) / 32;
                var bucketCol = col >= 0 ? col / 32 : (col - 31) / 32;
                var bucket = $"{bucketRow}:{bucketCol}";

                var existing = await _db.TerritoryClaims
                    .FirstOrDefaultAsync(c => c.CellRow == row && c.CellCol == col);

                // Resolve city for new cells
                string? city = existing?.City;
                string? country = existing?.Country;
                string? neighborhood = existing?.Neighborhood;
                if (city == null && country == null && dr == 0 && dc == 0)
                {
                    var geo = await _cityLookup.LookupAsync(latitude, longitude, row, col);
                    city = geo.City;
                    country = geo.Country;
                }

                if (existing != null)
                {
                    existing.ClaimedByUserId = userId;
                    existing.Color = color;
                    existing.ClaimedAt = DateTime.UtcNow;
                    existing.Bucket = bucket;
                    if (city != null) existing.City = city;
                    if (country != null) existing.Country = country;
                }
                else
                {
                    _db.TerritoryClaims.Add(new TerritoryClaim
                    {
                        CellRow = row,
                        CellCol = col,
                        Bucket = bucket,
                        ClaimedByUserId = userId,
                        Color = color,
                        City = city,
                        Country = country,
                        Neighborhood = neighborhood,
                    });
                }

                // Log to history
                _db.TerritoryClaimHistory.Add(new TerritoryClaimHistory
                {
                    CellRow = row,
                    CellCol = col,
                    UserId = userId,
                    Color = color,
                    Action = "blast",
                });

                cellsAffected++;
            }
        }

        await _db.SaveChangesAsync();

        return new PowerupUseResultDto
        {
            Success = true,
            Message = $"� Blast! Painted {cellsAffected} zones in your color.",
            CellsAffected = cellsAffected,
        };
    }
}

// ─── DTOs ───

public class PowerupLocationDto
{
    public long CellRow { get; set; }
    public long CellCol { get; set; }
    public required string PowerupType { get; set; }
    public required string Name { get; set; }
    public required string Emoji { get; set; }
}

public class PowerupClaimResultDto
{
    public Guid ClaimId { get; set; }
    public required string PowerupType { get; set; }
    public required string Name { get; set; }
    public required string Description { get; set; }
    public required string Emoji { get; set; }
}

public class PowerupInventoryItemDto
{
    public Guid ClaimId { get; set; }
    public required string PowerupType { get; set; }
    public required string Name { get; set; }
    public required string Description { get; set; }
    public required string Emoji { get; set; }
    public DateTime ClaimedAt { get; set; }
}

public class PowerupUseResultDto
{
    public bool Success { get; set; }
    public string Message { get; set; } = "";
    public int CellsAffected { get; set; }
}

public class PowerupUseRequest
{
    public Guid ClaimId { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
}

// ─── DI ───

public static class PowerupServiceExtensions
{
    public static IServiceCollection AddPowerupServices(this IServiceCollection services)
    {
        services.AddScoped<IPowerupService, PowerupService>();
        return services;
    }
}
