using System.Security.Cryptography;
using System.Text;
using System.Collections.Concurrent;

namespace Cliq.Server.Services;

/// <summary>
/// Registry of all powerup types. Add new powerups here — everything else is automatic.
/// </summary>
public static class PowerupRegistry
{
    public static readonly PowerupDefinition[] All =
    {
        new("blast", "💥 Blast", "Paint a 5×5 area around you in your color.", "💥", AvailableAfterDays: 4),
        new("poison", "☠️ Poison", "Poison the current cell. The next claimer is blocked and gets doubled cooldown for 24 hours.", "☠️", AvailableAfterDays: 4),
        // Future powerups:
        // new("lightning", "⚡ Lightning", "No cooldown for 1 hour.", "⚡", AvailableAfterDays: 14),
        // new("shield", "🛡️ Shield", "Protect a 3×3 area for 24 hours.", "🛡️", AvailableAfterDays: 21),
    };

    private static readonly Dictionary<string, PowerupDefinition> _byId =
        All.ToDictionary(p => p.Id, StringComparer.OrdinalIgnoreCase);

    public static PowerupDefinition? Get(string id) =>
        _byId.GetValueOrDefault(id);

    /// <summary>IDs of powerups currently spawnable, filtered by game start time.</summary>
    public static string[] GetSpawnableIds(DateTime gameStartUtc)
    {
        var elapsed = DateTime.UtcNow - gameStartUtc;
        return All
            .Where(p => elapsed.TotalDays >= p.AvailableAfterDays)
            .Select(p => p.Id)
            .ToArray();
    }
}

public record PowerupDefinition(
    string Id, string Name, string Description, string Emoji,
    int AvailableAfterDays = 0);

/// <summary>
/// Procedurally generates powerup locations using deterministic hashing.
/// The world grid is divided into "super-cells" (SpacingCells × SpacingCells).
/// Each super-cell gets exactly one powerup at a deterministic offset within it.
/// Positions change daily (midnight PDT). No DB storage needed for locations.
/// </summary>
public class PowerupSpawner
{
    /// <summary>
    /// Super-cell size in game cells. Each super-cell spawns exactly 1 powerup.
    /// With 500ft cells, 20 cells ≈ 10,000 ft ≈ ~2 miles per super-cell.
    /// </summary>
    private const int SpacingCells = 20;

    /// <summary>Secret salt to prevent clients from predicting powerup locations.</summary>
    private const string Salt = "FrenZones-Powerup-Salt-2026";

    // Temporary test override(s): forced spawns bypass normal procedural generation.
    // Remove after testing poison behavior.
    private static readonly ForcedPowerupSpawn[] ForcedSpawns =
    {
        // Centered around user-provided coordinate cell (30722, -49138)
        // so poison is easy to spot during testing.
        new(30722, -49138, "poison"),
        new(30721, -49138, "poison"),
        new(30723, -49138, "poison"),
        new(30722, -49139, "poison"),
        new(30721, -49139, "poison"),
        new(30722, -49137, "poison"),
    };

    // Runtime-only overrides used by territory test tooling.
    private static readonly ConcurrentDictionary<string, ForcedPowerupSpawn> TestForcedSpawns = new();

    public static void SetTestForcedSpawn(long cellRow, long cellCol, string powerupType, string? dateKey = null)
    {
        var normalizedDateKey = string.IsNullOrWhiteSpace(dateKey) ? null : dateKey;
        var key = BuildForcedSpawnKey(cellRow, cellCol, normalizedDateKey);
        TestForcedSpawns[key] = new ForcedPowerupSpawn(cellRow, cellCol, powerupType, normalizedDateKey);
    }

    public static bool RemoveTestForcedSpawn(long cellRow, long cellCol, string? dateKey = null)
    {
        var normalizedDateKey = string.IsNullOrWhiteSpace(dateKey) ? null : dateKey;
        var key = BuildForcedSpawnKey(cellRow, cellCol, normalizedDateKey);
        return TestForcedSpawns.TryRemove(key, out _);
    }

    public static ForcedPowerupSpawn? GetTestForcedSpawnAtCell(long cellRow, long cellCol, string? dateKey = null)
    {
        var normalizedDateKey = string.IsNullOrWhiteSpace(dateKey) ? null : dateKey;
        if (normalizedDateKey != null)
        {
            var datedKey = BuildForcedSpawnKey(cellRow, cellCol, normalizedDateKey);
            if (TestForcedSpawns.TryGetValue(datedKey, out var datedMatch))
                return datedMatch;
        }

        var wildcardKey = BuildForcedSpawnKey(cellRow, cellCol, null);
        return TestForcedSpawns.TryGetValue(wildcardKey, out var wildcardMatch)
            ? wildcardMatch
            : null;
    }

    /// <summary>
    /// Get today's date key in PDT (UTC-7). Daily reset at midnight PDT.
    /// </summary>
    public static string GetTodayDateKey()
    {
        var pdt = TimeZoneInfo.FindSystemTimeZoneById("America/Los_Angeles");
        var now = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, pdt);
        return now.ToString("yyyy-MM-dd");
    }

    /// <summary>
    /// Get all powerup spawn positions within a cell bounding box.
    /// Returns the cell (row, col) and type for each powerup.
    /// </summary>
    public static List<PowerupSpawn> GetPowerupsInBounds(
        long minRow, long maxRow, long minCol, long maxCol, string dateKey, DateTime gameStartUtc)
    {
        var spawns = new List<PowerupSpawn>();
        var types = PowerupRegistry.GetSpawnableIds(gameStartUtc);
        if (types.Length == 0)
        {
            // Even if procedural spawning is disabled (e.g., before unlock day),
            // allow forced testing spawns to appear.
            return GetForcedSpawnsInBounds(minRow, maxRow, minCol, maxCol, dateKey);
        }

        // Find which super-cells overlap the bounds
        var minSuperRow = FloorDiv(minRow, SpacingCells);
        var maxSuperRow = FloorDiv(maxRow, SpacingCells);
        var minSuperCol = FloorDiv(minCol, SpacingCells);
        var maxSuperCol = FloorDiv(maxCol, SpacingCells);

        for (var sr = minSuperRow; sr <= maxSuperRow; sr++)
        {
            for (var sc = minSuperCol; sc <= maxSuperCol; sc++)
            {
                var hash = Hash(sr, sc, dateKey);

                // Deterministic offset within the super-cell
                var offsetRow = (int)(hash % (uint)SpacingCells);
                var offsetCol = (int)((hash >> 8) % (uint)SpacingCells);
                var cellRow = sr * SpacingCells + offsetRow;
                var cellCol = sc * SpacingCells + offsetCol;

                // Only include if within the requested bounds
                if (cellRow >= minRow && cellRow <= maxRow &&
                    cellCol >= minCol && cellCol <= maxCol)
                {
                    var typeIdx = (int)((hash >> 16) % (uint)types.Length);
                    spawns.Add(new PowerupSpawn(cellRow, cellCol, types[typeIdx]));
                }
            }
        }

        var proceduralCellKeys = spawns
            .Select(s => $"{s.CellRow}:{s.CellCol}")
            .ToHashSet(StringComparer.Ordinal);

        foreach (var forced in GetForcedSpawnsInBounds(minRow, maxRow, minCol, maxCol, dateKey))
        {
            if (proceduralCellKeys.Contains($"{forced.CellRow}:{forced.CellCol}"))
                continue;
            spawns.Add(forced);
        }

        return spawns;
    }

    /// <summary>
    /// Check if a specific cell has a powerup today.
    /// </summary>
    public static PowerupSpawn? GetPowerupAtCell(long cellRow, long cellCol, string dateKey, DateTime gameStartUtc)
    {
        var forced = GetAllForcedSpawns().FirstOrDefault(f =>
            f.CellRow == cellRow
            && f.CellCol == cellCol
            && (f.DateKey == null || string.Equals(f.DateKey, dateKey, StringComparison.Ordinal)));
        if (forced != null)
            return new PowerupSpawn(forced.CellRow, forced.CellCol, forced.PowerupType);

        var types = PowerupRegistry.GetSpawnableIds(gameStartUtc);
        if (types.Length == 0) return null;

        var sr = FloorDiv(cellRow, SpacingCells);
        var sc = FloorDiv(cellCol, SpacingCells);
        var hash = Hash(sr, sc, dateKey);

        var offsetRow = (int)(hash % (uint)SpacingCells);
        var offsetCol = (int)((hash >> 8) % (uint)SpacingCells);
        var expectedRow = sr * SpacingCells + offsetRow;
        var expectedCol = sc * SpacingCells + offsetCol;

        if (expectedRow != cellRow || expectedCol != cellCol)
            return null;

        var typeIdx = (int)((hash >> 16) % (uint)types.Length);
        return new PowerupSpawn(cellRow, cellCol, types[typeIdx]);
    }

    private static uint Hash(long superRow, long superCol, string dateKey)
    {
        var input = $"{Salt}:{dateKey}:{superRow}:{superCol}";
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return BitConverter.ToUInt32(bytes, 0);
    }

    /// <summary>Floor division that handles negatives correctly.</summary>
    private static long FloorDiv(long a, long b)
    {
        return a >= 0 ? a / b : (a - b + 1) / b;
    }

    private static List<PowerupSpawn> GetForcedSpawnsInBounds(long minRow, long maxRow, long minCol, long maxCol, string dateKey)
    {
        return GetAllForcedSpawns()
            .Where(f => f.CellRow >= minRow && f.CellRow <= maxRow
                && f.CellCol >= minCol && f.CellCol <= maxCol
                && (f.DateKey == null || string.Equals(f.DateKey, dateKey, StringComparison.Ordinal)))
            .Select(f => new PowerupSpawn(f.CellRow, f.CellCol, f.PowerupType))
            .ToList();
    }

    private static IEnumerable<ForcedPowerupSpawn> GetAllForcedSpawns()
    {
        return ForcedSpawns.Concat(TestForcedSpawns.Values);
    }

    private static string BuildForcedSpawnKey(long cellRow, long cellCol, string? dateKey)
    {
        return $"{dateKey ?? "*"}:{cellRow}:{cellCol}";
    }
}

public record PowerupSpawn(long CellRow, long CellCol, string PowerupType);
public record ForcedPowerupSpawn(long CellRow, long CellCol, string PowerupType, string? DateKey = null);
