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

    public DateTime ClaimedAt { get; set; } = DateTime.UtcNow;
}
