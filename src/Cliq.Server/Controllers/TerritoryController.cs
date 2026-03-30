using Cliq.Server.Services;
using Cliq.Utilities;
using Microsoft.AspNetCore.Mvc;

namespace Cliq.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TerritoryController : ControllerBase
{
    private readonly ITerritoryService _territoryService;

    public TerritoryController(ITerritoryService territoryService)
    {
        _territoryService = territoryService;
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
        return Ok(cells);
    }

    /// <summary>Get the territory leaderboard.</summary>
    [HttpGet("leaderboard")]
    public async Task<ActionResult<List<TerritoryLeaderboardEntryDto>>> GetLeaderboard(
        [FromQuery] int top = 20)
    {
        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
            return Unauthorized();

        top = Math.Clamp(top, 1, 100);
        var leaderboard = await _territoryService.GetLeaderboardAsync(top);
        return Ok(leaderboard);
    }
}
