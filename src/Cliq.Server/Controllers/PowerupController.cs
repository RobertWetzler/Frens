using Cliq.Server.Services;
using Cliq.Utilities;
using Microsoft.AspNetCore.Mvc;

namespace Cliq.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PowerupController : ControllerBase
{
    private readonly IPowerupService _powerupService;

    public PowerupController(IPowerupService powerupService)
    {
        _powerupService = powerupService;
    }

    /// <summary>Get available (unclaimed) powerups within the map viewport.</summary>
    [HttpGet("inbounds")]
    public async Task<ActionResult<List<PowerupLocationDto>>> GetPowerupsInBounds(
        [FromQuery] double south,
        [FromQuery] double west,
        [FromQuery] double north,
        [FromQuery] double east)
    {
        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out _))
            return Unauthorized();

        var latSpan = Math.Abs(north - south);
        var lngSpan = Math.Abs(east - west);
        if (latSpan > 0.5 || lngSpan > 0.5)
            return BadRequest("Viewport too large.");

        var powerups = await _powerupService.GetPowerupsInBoundsAsync(south, west, north, east);
        return Ok(powerups);
    }

    /// <summary>Claim the powerup at the user's current location.</summary>
    [HttpPost("claim")]
    [ProducesResponseType(typeof(PowerupClaimResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<PowerupClaimResultDto>> ClaimPowerup(
        [FromBody] TerritoryClaimRequest request)
    {
        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
            return Unauthorized();

        try
        {
            var result = await _powerupService.ClaimPowerupAsync(userId, request.Latitude, request.Longitude);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    /// <summary>Get the current user's powerup inventory (unclaimed items).</summary>
    [HttpGet("inventory")]
    public async Task<ActionResult<List<PowerupInventoryItemDto>>> GetInventory()
    {
        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
            return Unauthorized();

        var items = await _powerupService.GetInventoryAsync(userId);
        return Ok(items);
    }

    /// <summary>Use a powerup from inventory at the user's current location.</summary>
    [HttpPost("use")]
    [ProducesResponseType(typeof(PowerupUseResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<PowerupUseResultDto>> UsePowerup(
        [FromBody] PowerupUseRequest request)
    {
        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
            return Unauthorized();

        try
        {
            var result = await _powerupService.UsePowerupAsync(
                userId, request.ClaimId, request.Latitude, request.Longitude);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }
}
