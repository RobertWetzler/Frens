
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
        if (!AuthUtils.TryGetUserIdFromToken(this.HttpContext, out var userId))
        {
            return Unauthorized();
        }
        return Ok(await _circleService.GetUserMemberCirclesAsync(userId));
    }

    [HttpGet("own")]
    public async Task<ActionResult<IEnumerable<CirclePublicDto>>> GetUserOwnedCircle()
    {
        if (!AuthUtils.TryGetUserIdFromToken(this.HttpContext, out var userId))
        {
            return Unauthorized();
        }
        return Ok(await _circleService.GetUserOwnedCirclesAsync(userId));
    }

    [HttpGet("with-members")]
    public async Task<ActionResult<IEnumerable<CircleWithMembersDto>>> GetUserCirclesWithMembers()
    {
        if (!AuthUtils.TryGetUserIdFromToken(this.HttpContext, out var userId))
        {
            return Unauthorized();
        }
        return Ok(await _circleService.GetUserCirclesWithMembersAsync(userId));
    }

    [HttpGet("{circleId}")]
    public async Task<ActionResult<CirclePublicDto>> GetCircle(Guid circleId)
    {
        // TODO: Auhtorization to ensure use is either owner or member of shared circle
        if (!AuthUtils.TryGetUserIdFromToken(this.HttpContext, out var userId))
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
        if (!AuthUtils.TryGetUserIdFromToken(this.HttpContext, out var userId))
        {
            return Unauthorized();
        }
        var createdCircle = await _circleService.CreateCircleAsync(userId, circleDto);
        return CreatedAtAction(nameof(GetCircle),
            new { circleId = createdCircle.Id }, // Route values
            new CirclePublicDto { Id = createdCircle.Id, Name = createdCircle.Name, IsShared = createdCircle.IsShared });
    }

    [HttpDelete("{circleId}")]
    public async Task<ActionResult> DeleteCircle(Guid circleId)
    {
        if (!AuthUtils.TryGetUserIdFromToken(this.HttpContext, out var userId))
        {
            return Unauthorized();
        }

        try
        {
            await _circleService.DeleteCircleAsync(userId, circleId);
            return NoContent();
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (BadHttpRequestException ex)
        {
            return NotFound(ex.Message);
        }
    }

    [HttpPost("users")]
    public async Task<ActionResult> AddUsersToCircle([FromBody] UpdateUsersInCircleRequest request)
    {
        if (!AuthUtils.TryGetUserIdFromToken(this.HttpContext, out var userId))
        {
            return Unauthorized();
        }
        var circleId = request.CircleId;
        var userIds = request.UserIds;

        if (userIds == null || userIds.Length == 0)
        {
            return BadRequest("No user IDs provided");
        }

        try
        {
            await _circleService.AddUsersToCircleAsync(userId, circleId, userIds);
            return Ok(new { message = $"Successfully added {userIds.Length} users to circle" });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
        catch (BadHttpRequestException ex)
        {
            return BadRequest(ex.Message);
        }
    }
    
    [HttpDelete("users")]
    public async Task<ActionResult> RemoveUsersFromCircle([FromBody] UpdateUsersInCircleRequest request)
    {
        if (!AuthUtils.TryGetUserIdFromToken(this.HttpContext, out var userId))
        {
            return Unauthorized();
        }
        var circleId = request.CircleId;
        var userIds = request.UserIds;

        if (userIds == null || userIds.Length == 0)
        {
            return BadRequest("No user IDs provided");
        }

        try
        {
            await _circleService.RemoveUsersFromCircleAsync(userId, circleId, userIds);
            return Ok(new { message = $"Successfully removed {userIds.Length} users from circle" });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
        catch (BadHttpRequestException ex)
        {
            return BadRequest(ex.Message);
        }
    }
}

public class UpdateUsersInCircleRequest
{
    public required Guid CircleId { get; init; }
    public required Guid[] UserIds { get; init; } 
}