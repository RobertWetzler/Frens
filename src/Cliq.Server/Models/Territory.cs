namespace Cliq.Server.Models;

/// <summary>
/// A player registered for the Territory Wars game with their chosen color.
/// </summary>
public class TerritoryPlayer
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    /// <summary>Hex color chosen by the player, e.g. "#FF4444"</summary>
    public required string Color { get; set; }

    public DateTime RegisteredAt { get; set; } = DateTime.UtcNow;

    /// <summary>When the player last claimed a cell (for cooldown enforcement).</summary>
    public DateTime? LastClaimAt { get; set; }

    /// <summary>
    /// If set in the future, this player is poisoned and claim cooldown is doubled.
    /// </summary>
    public DateTime? PoisonPenaltyUntilUtc { get; set; }
}

/// <summary>
/// A single claimed cell on the territory grid.
/// Cells are identified by (CellRow, CellCol) computed from lat/lng.
/// Uses geohash-style bucketing for efficient spatial queries.
/// </summary>
public class TerritoryClaim
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Grid row index (floor(latitude / CELL_SIZE_LAT))</summary>
    public long CellRow { get; set; }

    /// <summary>Grid column index (floor(longitude / CELL_SIZE_LNG))</summary>
    public long CellCol { get; set; }

    /// <summary>
    /// Spatial bucket key for efficient range queries.
    /// Computed as (CellRow / BucketSize, CellCol / BucketSize) encoded as a string "rowBucket:colBucket".
    /// Allows querying nearby cells by bucket instead of scanning the whole table.
    /// </summary>
    public required string Bucket { get; set; }

    public Guid ClaimedByUserId { get; set; }
    public User ClaimedByUser { get; set; } = null!;

    /// <summary>Hex color at time of claim (denormalized from TerritoryPlayer for fast rendering)</summary>
    public required string Color { get; set; }

    /// <summary>City name resolved via reverse geocoding at claim time. Null if geocoding failed.</summary>
    public string? City { get; set; }

    /// <summary>Country name resolved via reverse geocoding at claim time.</summary>
    public string? Country { get; set; }

    /// <summary>Neighborhood/suburb resolved via reverse geocoding at claim time.</summary>
    public string? Neighborhood { get; set; }

    public DateTime ClaimedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Append-only audit log of every cell claim event.
/// Used for timelapse replay and analytics — never queried during live gameplay.
/// </summary>
public class TerritoryClaimHistory
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public long CellRow { get; set; }
    public long CellCol { get; set; }

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public required string Color { get; set; }

    /// <summary>The type of action: "claim", "blast", "incognito", etc.</summary>
    public string Action { get; set; } = "claim";

    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// A powerup that was picked up by a player. Tracks inventory and usage.
/// Powerup locations are procedurally generated — only claims are stored.
/// </summary>
public class PowerupClaim
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    /// <summary>The cell where the powerup was picked up.</summary>
    public long CellRow { get; set; }
    public long CellCol { get; set; }

    /// <summary>Powerup type identifier, e.g. "bomb", "lightning".</summary>
    public required string PowerupType { get; set; }

    /// <summary>Date key for daily reset, e.g. "2026-04-02" in PDT.</summary>
    public required string DateKey { get; set; }

    public DateTime ClaimedAt { get; set; } = DateTime.UtcNow;

    /// <summary>When the powerup was used. Null if still in inventory.</summary>
    public DateTime? UsedAt { get; set; }
}

/// <summary>
/// Hidden poisoned cells. If a different player tries to claim an active poisoned cell,
/// the claim fails and that player receives a 24-hour doubled cooldown penalty.
/// </summary>
public class TerritoryCellPoison
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public long CellRow { get; set; }
    public long CellCol { get; set; }

    public Guid PoisonedByUserId { get; set; }
    public User PoisonedByUser { get; set; } = null!;

    public DateTime PoisonedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAtUtc { get; set; }

    /// <summary>Set when someone triggers the poison by attempting to claim this cell.</summary>
    public DateTime? TriggeredAtUtc { get; set; }
    public Guid? TriggeredByUserId { get; set; }
    public User? TriggeredByUser { get; set; }
}
