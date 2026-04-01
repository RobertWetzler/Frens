using Cliq.Server.Services;
using Cliq.Utilities;
using Microsoft.AspNetCore.Mvc;

namespace Cliq.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TerritoryController : ControllerBase
{
    private readonly ITerritoryService _territoryService;
    private readonly IConfiguration _configuration;

    public TerritoryController(ITerritoryService territoryService, IConfiguration configuration)
    {
        _territoryService = territoryService;
        _configuration = configuration;
    }

    /// <summary>Check if the territory game is currently active.</summary>
    [HttpGet("active")]
    public ActionResult<TerritoryActiveDto> IsActive()
    {
        var now = DateTime.UtcNow;
        var startUtc = ParseConfigDateTime("TerritoryGame:StartUtc")
            ?? new DateTime(2026, 4, 3, 14, 0, 0, DateTimeKind.Utc); // April 3 7am PST
        var endUtc = ParseConfigDateTime("TerritoryGame:EndUtc")
            ?? new DateTime(2026, 5, 1, 7, 0, 0, DateTimeKind.Utc);  // April 30 midnight PST

        return Ok(new TerritoryActiveDto
        {
            IsActive = now >= startUtc && now < endUtc,
            StartUtc = startUtc,
            EndUtc = endUtc,
        });
    }

    private DateTime? ParseConfigDateTime(string key)
    {
        var raw = _configuration[key];
        if (!string.IsNullOrWhiteSpace(raw) && DateTime.TryParse(raw, null,
                System.Globalization.DateTimeStyles.AdjustToUniversal, out var dt))
            return dt;
        return null;
    }

    /// <summary>Get the current user's territory game state (registered, color, cooldown).</summary>
    [HttpGet("state")]
    public async Task<ActionResult<TerritoryGameStateDto>> GetGameState()
    {
        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
            return Unauthorized();

        return Ok(await _territoryService.GetGameStateAsync(userId));
    }

    /// <summary>Register for Territory Wars with a chosen color.</summary>
    [HttpPost("register")]
    [ProducesResponseType(typeof(TerritoryPlayerDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<TerritoryPlayerDto>> Register([FromBody] TerritoryRegisterRequest request)
    {
        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
            return Unauthorized();

        try
        {
            var player = await _territoryService.RegisterAsync(userId, request.Color);
            return Created(string.Empty, player);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    /// <summary>Claim the cell at the user's current location.</summary>
    [HttpPost("claim")]
    [ProducesResponseType(typeof(TerritoryCellDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<TerritoryCellDto>> ClaimCell([FromBody] TerritoryClaimRequest request)
    {
        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
            return Unauthorized();

        try
        {
            var cell = await _territoryService.ClaimCellAsync(userId, request.Latitude, request.Longitude);
            return Ok(cell);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    /// <summary>Get claimed cells within the given lat/lng bounding box for map rendering.</summary>
    [HttpGet("cells")]
    public async Task<ActionResult<List<TerritoryCellDto>>> GetCellsInBounds(
        [FromQuery] double south,
        [FromQuery] double west,
        [FromQuery] double north,
        [FromQuery] double east)
    {
        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
            return Unauthorized();

        // Limit viewport size to prevent scanning the whole table
        var latSpan = Math.Abs(north - south);
        var lngSpan = Math.Abs(east - west);
        if (latSpan > 0.5 || lngSpan > 0.5)
            return BadRequest("Viewport too large. Zoom in.");

        var cells = await _territoryService.GetCellsInBoundsAsync(south, west, north, east);

        // Strip neighborhood data before the configured reveal date
        var neighborhoodsAfter = ParseConfigDateTime("TerritoryGame:NeighborhoodsAfterUtc")
            ?? (ParseConfigDateTime("TerritoryGame:StartUtc")
                ?? new DateTime(2026, 4, 3, 14, 0, 0, DateTimeKind.Utc)).AddDays(7);
        if (DateTime.UtcNow < neighborhoodsAfter)
        {
            foreach (var cell in cells)
                cell.Neighborhood = null;
        }

        return Ok(cells);
    }

    /// <summary>Get the territory leaderboard grouped by city, with the current user's cities first.</summary>
    [HttpGet("leaderboard")]
    public async Task<ActionResult<TerritoryCityLeaderboardDto>> GetLeaderboard(
        [FromQuery] int topPerCity = 10)
    {
        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
            return Unauthorized();

        topPerCity = Math.Clamp(topPerCity, 1, 50);

        // Neighborhoods appear after a configurable date (default: 1 week after game start)
        var neighborhoodsAfter = ParseConfigDateTime("TerritoryGame:NeighborhoodsAfterUtc")
            ?? (ParseConfigDateTime("TerritoryGame:StartUtc")
                ?? new DateTime(2026, 4, 3, 14, 0, 0, DateTimeKind.Utc)).AddDays(7);
        var includeNeighborhoods = DateTime.UtcNow >= neighborhoodsAfter;

        var leaderboard = await _territoryService.GetCityLeaderboardAsync(userId, topPerCity, includeNeighborhoods);
        return Ok(leaderboard);
    }

    /// <summary>Change the player's color.</summary>
    [HttpPut("color")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult> ChangeColor([FromBody] TerritoryRegisterRequest request)
    {
        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
            return Unauthorized();

        try
        {
            await _territoryService.ChangeColorAsync(userId, request.Color);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }
}
