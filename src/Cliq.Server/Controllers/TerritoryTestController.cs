using Cliq.Server.Data;
using Cliq.Server.Models;
using Cliq.Server.Services;
using Cliq.Utilities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cliq.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TerritoryTestController : ControllerBase
{
    private static readonly TimeSpan DefaultPoisonDuration = TimeSpan.FromHours(24);
    private const int BucketSize = 32;
    private static readonly string[] SupportedCellStatuses = { "empty", "poisoned" };

    private readonly CliqDbContext _db;
    private readonly IConfiguration _configuration;
    private readonly IHostEnvironment _environment;
    private readonly ILogger<TerritoryTestController> _logger;

    public TerritoryTestController(
        CliqDbContext db,
        IConfiguration configuration,
        IHostEnvironment environment,
        ILogger<TerritoryTestController> logger)
    {
        _db = db;
        _configuration = configuration;
        _environment = environment;
        _logger = logger;
    }

    [HttpGet("mode")]
    [AllowAnonymous]
    public ActionResult<TerritoryTestModeDto> GetMode()
    {
        return Ok(new TerritoryTestModeDto
        {
            Enabled = IsTestModeEnabled(),
        });
    }

    [HttpGet("editor/options")]
    public async Task<ActionResult<TerritoryTestEditorOptionsDto>> GetEditorOptions()
    {
        if (!IsTestModeEnabled())
            return NotFound();

        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out _))
            return Unauthorized();

        var assignees = await _db.Users.AsNoTracking()
            .OrderBy(u => u.Name)
            .Select(u => new TerritoryTestAssigneeOptionDto
            {
                UserId = u.Id,
                Username = u.Name,
            })
            .ToListAsync();

        var powerupTypes = new List<string> { "none" };
        powerupTypes.AddRange(PowerupRegistry.All.Select(p => p.Id));

        return Ok(new TerritoryTestEditorOptionsDto
        {
            Assignees = assignees,
            PowerupTypes = powerupTypes,
            CellStatuses = SupportedCellStatuses,
        });
    }

    [HttpGet("editor/cell")]
    public async Task<ActionResult<TerritoryTestCellEditorStateDto>> GetCellEditorState(
        [FromQuery] long row,
        [FromQuery] long col,
        [FromQuery] string? dateKey = null)
    {
        if (!IsTestModeEnabled())
            return NotFound();

        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out _))
            return Unauthorized();

        var claim = await _db.TerritoryClaims
            .AsNoTracking()
            .Include(c => c.ClaimedByUser)
            .FirstOrDefaultAsync(c => c.CellRow == row && c.CellCol == col);

        var now = DateTime.UtcNow;
        var activePoison = await _db.TerritoryCellPoisons
            .AsNoTracking()
            .AnyAsync(p => p.CellRow == row
                && p.CellCol == col
                && p.TriggeredAtUtc == null
                && p.ExpiresAtUtc > now);

        var forcedPowerup = PowerupSpawner.GetTestForcedSpawnAtCell(row, col, dateKey);

        return Ok(new TerritoryTestCellEditorStateDto
        {
            Row = row,
            Col = col,
            AssigneeUserId = claim?.ClaimedByUserId,
            AssigneeUsername = claim?.ClaimedByUser.Name,
            PowerupType = forcedPowerup?.PowerupType ?? "none",
            CellStatus = activePoison ? "poisoned" : "empty",
        });
    }

    [HttpPost("editor/save")]
    public async Task<ActionResult<TerritoryTestCellEditorStateDto>> SaveCellEditorState([FromBody] SaveTerritoryCellEditorRequest request)
    {
        if (!IsTestModeEnabled())
            return NotFound();

        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var actorUserId))
            return Unauthorized();

        if (!SupportedCellStatuses.Contains(request.CellStatus, StringComparer.OrdinalIgnoreCase))
            return BadRequest($"Unsupported cell status '{request.CellStatus}'.");

        var now = DateTime.UtcNow;
        var hasDbChanges = false;

        // 1) Assignee
        if (string.IsNullOrWhiteSpace(request.AssigneeUserId))
        {
            var existingClaim = await _db.TerritoryClaims
                .FirstOrDefaultAsync(c => c.CellRow == request.Row && c.CellCol == request.Col);
            if (existingClaim != null)
            {
                _db.TerritoryClaims.Remove(existingClaim);
                _db.TerritoryClaimHistory.Add(new TerritoryClaimHistory
                {
                    CellRow = request.Row,
                    CellCol = request.Col,
                    UserId = actorUserId,
                    Color = "#999999",
                    Action = "test-unassign",
                    Timestamp = now,
                });
                hasDbChanges = true;
            }
        }
        else
        {
            if (!Guid.TryParse(request.AssigneeUserId, out var assigneeUserId))
                return BadRequest("Assignee user id must be a valid GUID.");

            var targetUser = await _db.Users.AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == assigneeUserId);
            if (targetUser == null)
                return BadRequest("Target user not found.");

            var color = await _db.TerritoryPlayers
                .Where(p => p.UserId == assigneeUserId)
                .Select(p => p.Color)
                .FirstOrDefaultAsync() ?? "#999999";

            var existing = await _db.TerritoryClaims
                .FirstOrDefaultAsync(c => c.CellRow == request.Row && c.CellCol == request.Col);

            if (existing == null)
            {
                existing = new TerritoryClaim
                {
                    CellRow = request.Row,
                    CellCol = request.Col,
                    Bucket = ComputeBucket(request.Row, request.Col),
                    ClaimedByUserId = assigneeUserId,
                    Color = color,
                    ClaimedAt = now,
                };
                _db.TerritoryClaims.Add(existing);
            }
            else
            {
                existing.ClaimedByUserId = assigneeUserId;
                existing.Color = color;
                existing.ClaimedAt = now;
                existing.Bucket = ComputeBucket(request.Row, request.Col);
            }

            _db.TerritoryClaimHistory.Add(new TerritoryClaimHistory
            {
                CellRow = request.Row,
                CellCol = request.Col,
                UserId = assigneeUserId,
                Color = color,
                Action = "test-assign",
                Timestamp = now,
            });
            hasDbChanges = true;
        }

        // 2) Powerup override
        if (string.IsNullOrWhiteSpace(request.PowerupType)
            || request.PowerupType.Equals("none", StringComparison.OrdinalIgnoreCase))
        {
            PowerupSpawner.RemoveTestForcedSpawn(request.Row, request.Col, request.DateKey);
        }
        else
        {
            if (PowerupRegistry.Get(request.PowerupType) == null)
                return BadRequest($"Unknown powerup type '{request.PowerupType}'.");

            PowerupSpawner.SetTestForcedSpawn(request.Row, request.Col, request.PowerupType, request.DateKey);
        }

        // 3) Cell status
        if (request.CellStatus.Equals("poisoned", StringComparison.OrdinalIgnoreCase))
        {
            var alreadyActive = await _db.TerritoryCellPoisons
                .AnyAsync(p => p.CellRow == request.Row
                    && p.CellCol == request.Col
                    && p.TriggeredAtUtc == null
                    && p.ExpiresAtUtc > now);

            if (!alreadyActive)
            {
                _db.TerritoryCellPoisons.Add(new TerritoryCellPoison
                {
                    CellRow = request.Row,
                    CellCol = request.Col,
                    PoisonedByUserId = actorUserId,
                    PoisonedAtUtc = now,
                    ExpiresAtUtc = now.Add(DefaultPoisonDuration),
                });

                _db.TerritoryClaimHistory.Add(new TerritoryClaimHistory
                {
                    CellRow = request.Row,
                    CellCol = request.Col,
                    UserId = actorUserId,
                    Color = "#7A7A7A",
                    Action = "test-poison",
                    Timestamp = now,
                });
                hasDbChanges = true;
            }
        }
        else if (request.CellStatus.Equals("empty", StringComparison.OrdinalIgnoreCase))
        {
            var activePoisons = await _db.TerritoryCellPoisons
                .Where(p => p.CellRow == request.Row
                    && p.CellCol == request.Col
                    && p.TriggeredAtUtc == null
                    && p.ExpiresAtUtc > now)
                .ToListAsync();

            if (activePoisons.Count > 0)
            {
                foreach (var poison in activePoisons)
                {
                    poison.ExpiresAtUtc = now;
                }

                _db.TerritoryClaimHistory.Add(new TerritoryClaimHistory
                {
                    CellRow = request.Row,
                    CellCol = request.Col,
                    UserId = actorUserId,
                    Color = "#7A7A7A",
                    Action = "test-unpoison",
                    Timestamp = now,
                });
                hasDbChanges = true;
            }
        }

        if (hasDbChanges)
            await _db.SaveChangesAsync();

        return await GetCellEditorState(request.Row, request.Col, request.DateKey);
    }

    [HttpPost("cell/assign")]
    public async Task<ActionResult<TerritoryCellDto>> AssignCell([FromBody] AssignTerritoryCellRequest request)
    {
        if (!IsTestModeEnabled())
            return NotFound();

        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var actorUserId))
            return Unauthorized();

        var targetUser = await _db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == request.UserId);
        if (targetUser == null)
            return BadRequest("Target user not found.");

        var color = request.Color;
        if (string.IsNullOrWhiteSpace(color))
        {
            color = await _db.TerritoryPlayers
                .Where(p => p.UserId == request.UserId)
                .Select(p => p.Color)
                .FirstOrDefaultAsync() ?? "#999999";
        }

        var now = DateTime.UtcNow;
        var existing = await _db.TerritoryClaims
            .FirstOrDefaultAsync(c => c.CellRow == request.Row && c.CellCol == request.Col);

        if (existing == null)
        {
            existing = new TerritoryClaim
            {
                CellRow = request.Row,
                CellCol = request.Col,
                Bucket = ComputeBucket(request.Row, request.Col),
                ClaimedByUserId = request.UserId,
                Color = color,
                ClaimedAt = now,
            };
            _db.TerritoryClaims.Add(existing);
        }
        else
        {
            existing.ClaimedByUserId = request.UserId;
            existing.Color = color;
            existing.ClaimedAt = now;
            existing.Bucket = ComputeBucket(request.Row, request.Col);
        }

        _db.TerritoryClaimHistory.Add(new TerritoryClaimHistory
        {
            CellRow = request.Row,
            CellCol = request.Col,
            UserId = request.UserId,
            Color = color,
            Action = "test-assign",
            Timestamp = now,
        });

        await _db.SaveChangesAsync();

        _logger.LogInformation(
            "Territory test assign by {ActorUserId}: row={Row}, col={Col}, targetUser={TargetUserId}",
            actorUserId,
            request.Row,
            request.Col,
            request.UserId);

        return Ok(new TerritoryCellDto
        {
            Row = request.Row,
            Col = request.Col,
            ClaimedBy = request.UserId.ToString(),
            ClaimedByName = targetUser.Name,
            Color = color,
            ClaimedAt = now,
            City = existing.City,
            Neighborhood = existing.Neighborhood,
        });
    }

    [HttpPost("cell/unassign")]
    public async Task<ActionResult> UnassignCell([FromBody] TerritoryCellCoordinateRequest request)
    {
        if (!IsTestModeEnabled())
            return NotFound();

        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var actorUserId))
            return Unauthorized();

        var existing = await _db.TerritoryClaims
            .FirstOrDefaultAsync(c => c.CellRow == request.Row && c.CellCol == request.Col);
        if (existing == null)
            return NotFound("Cell is not assigned.");

        _db.TerritoryClaims.Remove(existing);

        _db.TerritoryClaimHistory.Add(new TerritoryClaimHistory
        {
            CellRow = request.Row,
            CellCol = request.Col,
            UserId = actorUserId,
            Color = "#999999",
            Action = "test-unassign",
            Timestamp = DateTime.UtcNow,
        });

        await _db.SaveChangesAsync();

        _logger.LogInformation(
            "Territory test unassign by {ActorUserId}: row={Row}, col={Col}",
            actorUserId,
            request.Row,
            request.Col);

        return NoContent();
    }

    [HttpPost("cell/powerup/add")]
    public ActionResult AddPowerup([FromBody] TerritoryTestPowerupRequest request)
    {
        if (!IsTestModeEnabled())
            return NotFound();

        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var actorUserId))
            return Unauthorized();

        if (string.IsNullOrWhiteSpace(request.PowerupType))
            return BadRequest("Powerup type is required.");

        if (PowerupRegistry.Get(request.PowerupType) == null)
            return BadRequest($"Unknown powerup type '{request.PowerupType}'.");

        PowerupSpawner.SetTestForcedSpawn(request.Row, request.Col, request.PowerupType, request.DateKey);

        _logger.LogInformation(
            "Territory test add powerup by {ActorUserId}: row={Row}, col={Col}, type={PowerupType}, dateKey={DateKey}",
            actorUserId,
            request.Row,
            request.Col,
            request.PowerupType,
            request.DateKey ?? "*");

        return NoContent();
    }

    [HttpPost("cell/powerup/remove")]
    public ActionResult RemovePowerup([FromBody] TerritoryTestPowerupRemoveRequest request)
    {
        if (!IsTestModeEnabled())
            return NotFound();

        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var _))
            return Unauthorized();

        var removed = PowerupSpawner.RemoveTestForcedSpawn(request.Row, request.Col, request.DateKey);
        if (!removed)
            return NotFound("No runtime test powerup override found for that cell/date.");

        return NoContent();
    }

    [HttpPost("cell/status")]
    public async Task<ActionResult> SetCellStatus([FromBody] TerritoryCellStatusRequest request)
    {
        if (!IsTestModeEnabled())
            return NotFound();

        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var actorUserId))
            return Unauthorized();

        if (request.Status.Equals("poisoned", StringComparison.OrdinalIgnoreCase))
        {
            var now = DateTime.UtcNow;
            var alreadyActive = await _db.TerritoryCellPoisons
                .AnyAsync(p => p.CellRow == request.Row
                    && p.CellCol == request.Col
                    && p.TriggeredAtUtc == null
                    && p.ExpiresAtUtc > now);

            if (!alreadyActive)
            {
                _db.TerritoryCellPoisons.Add(new TerritoryCellPoison
                {
                    CellRow = request.Row,
                    CellCol = request.Col,
                    PoisonedByUserId = request.PoisonedByUserId ?? actorUserId,
                    PoisonedAtUtc = now,
                    ExpiresAtUtc = now.AddHours(request.DurationHours.GetValueOrDefault(DefaultPoisonDuration.TotalHours)),
                });

                _db.TerritoryClaimHistory.Add(new TerritoryClaimHistory
                {
                    CellRow = request.Row,
                    CellCol = request.Col,
                    UserId = actorUserId,
                    Color = "#7A7A7A",
                    Action = "test-poison",
                    Timestamp = now,
                });

                await _db.SaveChangesAsync();
            }

            return NoContent();
        }

        if (request.Status.Equals("unpoisoned", StringComparison.OrdinalIgnoreCase))
        {
            var now = DateTime.UtcNow;
            var activePoisons = await _db.TerritoryCellPoisons
                .Where(p => p.CellRow == request.Row
                    && p.CellCol == request.Col
                    && p.TriggeredAtUtc == null
                    && p.ExpiresAtUtc > now)
                .ToListAsync();

            foreach (var poison in activePoisons)
            {
                poison.ExpiresAtUtc = now;
            }

            _db.TerritoryClaimHistory.Add(new TerritoryClaimHistory
            {
                CellRow = request.Row,
                CellCol = request.Col,
                UserId = actorUserId,
                Color = "#7A7A7A",
                Action = "test-unpoison",
                Timestamp = now,
            });

            await _db.SaveChangesAsync();
            return NoContent();
        }

        return BadRequest("Status must be 'poisoned' or 'unpoisoned'.");
    }

    private bool IsTestModeEnabled()
    {
        if (_environment.IsEnvironment("Testing"))
            return true;

        var raw = _configuration["TERRITORY_TEST_MODE"];
        if (string.IsNullOrWhiteSpace(raw))
            raw = _configuration["TerritoryGame:TestModeEnabled"];

        return bool.TryParse(raw, out var enabled) && enabled;
    }

    private static string ComputeBucket(long cellRow, long cellCol)
    {
        var bucketRow = cellRow >= 0 ? cellRow / BucketSize : (cellRow - BucketSize + 1) / BucketSize;
        var bucketCol = cellCol >= 0 ? cellCol / BucketSize : (cellCol - BucketSize + 1) / BucketSize;
        return $"{bucketRow}:{bucketCol}";
    }
}

public class TerritoryTestModeDto
{
    public bool Enabled { get; set; }
}

public class TerritoryCellCoordinateRequest
{
    public long Row { get; set; }
    public long Col { get; set; }
}

public sealed class AssignTerritoryCellRequest : TerritoryCellCoordinateRequest
{
    public Guid UserId { get; set; }
    public string? Color { get; set; }
}

public sealed class TerritoryCellStatusRequest : TerritoryCellCoordinateRequest
{
    public required string Status { get; set; }
    public Guid? PoisonedByUserId { get; set; }
    public double? DurationHours { get; set; }
}

public sealed class TerritoryTestPowerupRequest : TerritoryCellCoordinateRequest
{
    public required string PowerupType { get; set; }
    public string? DateKey { get; set; }
}

public sealed class TerritoryTestPowerupRemoveRequest : TerritoryCellCoordinateRequest
{
    public string? DateKey { get; set; }
}

public sealed class TerritoryTestEditorOptionsDto
{
    public List<TerritoryTestAssigneeOptionDto> Assignees { get; set; } = new();
    public List<string> PowerupTypes { get; set; } = new();
    public IReadOnlyList<string> CellStatuses { get; set; } = Array.Empty<string>();
}

public sealed class TerritoryTestAssigneeOptionDto
{
    public Guid UserId { get; set; }
    public required string Username { get; set; }
}

public sealed class TerritoryTestCellEditorStateDto
{
    public long Row { get; set; }
    public long Col { get; set; }
    public Guid? AssigneeUserId { get; set; }
    public string? AssigneeUsername { get; set; }
    public required string PowerupType { get; set; }
    public required string CellStatus { get; set; }
}

public sealed class SaveTerritoryCellEditorRequest : TerritoryCellCoordinateRequest
{
    public string? AssigneeUserId { get; set; }
    public required string PowerupType { get; set; }
    public required string CellStatus { get; set; }
    public string? DateKey { get; set; }
}
