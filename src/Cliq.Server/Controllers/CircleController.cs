
using Cliq.Server.Models;
using Cliq.Server.Services;
using Cliq.Utilities;
using Microsoft.AspNetCore.Mvc;

namespace Cliq.Server.Controllers;

[Route("api/[controller]")]
[ApiController]
public class CircleController : ControllerBase
{
    private readonly ICircleService _circleService;

    public CircleController(ICircleService circleService)
    {
        _circleService = circleService;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<CirclePublicDto>>> GetUserMemberCircle()
    {
        if(!AuthUtils.TryGetUserIdFromToken(this.HttpContext, out var userId))
        {
            return Unauthorized();
        }
        return Ok(await _circleService.GetUserMemberCirclesAsync(userId));
    }

    [HttpGet("own")]
    public async Task<ActionResult<IEnumerable<CirclePublicDto>>> GetUserOwnedCircle()
    {
        if(!AuthUtils.TryGetUserIdFromToken(this.HttpContext, out var userId))
        {
            return Unauthorized();
        }
        return Ok(await _circleService.GetUserOwnedCirclesAsync(userId));
    }

    [HttpGet("{circleId}")]
    public async Task<ActionResult<IEnumerable<CirclePublicDto>>> GetCircle(Guid circleId)
    {
        // TODO: Auhtorization to ensure use is either owner or member of shared circle
        if(!AuthUtils.TryGetUserIdFromToken(this.HttpContext, out var userId))
        {
            return Unauthorized();
        }
        var circle = await _circleService.GetCircleAsync(userId, circleId);
        if (circle == null)
        {
            return NotFound();
        }
        return Ok(circle);
    }

    [HttpPost]
    public async Task<ActionResult<CirclePublicDto>> CreateCircle([FromBody] CircleCreationDto circleDto)
    {
        if(!AuthUtils.TryGetUserIdFromToken(this.HttpContext, out var userId))
        {
            return Unauthorized();
        }
        var createdCircle = await _circleService.CreateCircleAsync(userId, circleDto);
        return CreatedAtAction(nameof(GetCircle),
            new { circleId = createdCircle.Id }, // Route values
            new CirclePublicDto{ Id = createdCircle.Id, Name = createdCircle.Name, IsShared = createdCircle.IsShared});
    }
}