using Cliq.Server.Models;
using Cliq.Server.Services;
using Cliq.Utilities;
using Microsoft.AspNetCore.Mvc;

namespace Cliq.Server.Controllers;

[Route("api/[controller]")]
[ApiController]
public class InterestController : ControllerBase
{
    private readonly IInterestService _interestService;

    public InterestController(IInterestService interestService)
    {
        _interestService = interestService;
    }

    /// <summary>
    /// Search/suggest interests by name prefix. Results ranked by how many friends use them.
    /// </summary>
    [HttpGet("search")]
    [ProducesResponseType(typeof(List<InterestSuggestionDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<InterestSuggestionDto>>> SearchInterests([FromQuery] string q, [FromQuery] int limit = 10)
    {
        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
            return Unauthorized();

        if (string.IsNullOrWhiteSpace(q))
            return Ok(new List<InterestSuggestionDto>());

        var results = await _interestService.SearchInterestsAsync(userId, q, limit);
        return Ok(results);
    }

    /// <summary>
    /// Get interests popular among the user's friends.
    /// </summary>
    [HttpGet("popular")]
    [ProducesResponseType(typeof(List<InterestSuggestionDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<InterestSuggestionDto>>> GetPopularInterests([FromQuery] int limit = 20)
    {
        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
            return Unauthorized();

        var results = await _interestService.GetPopularInterestsAsync(userId, limit);
        return Ok(results);
    }

    /// <summary>
    /// Get all interests the current user follows, with subscription details.
    /// </summary>
    [HttpGet("mine")]
    [ProducesResponseType(typeof(List<InterestDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<InterestDto>>> GetMyInterests()
    {
        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
            return Unauthorized();

        var interests = await _interestService.GetUserInterestsAsync(userId);
        return Ok(interests);
    }

    /// <summary>
    /// Get interests on a user's profile.
    /// </summary>
    [HttpGet("user/{targetUserId}")]
    [ProducesResponseType(typeof(List<InterestPublicDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<InterestPublicDto>>> GetUserInterests(Guid targetUserId)
    {
        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out _))
            return Unauthorized();

        var interests = await _interestService.GetUserProfileInterestsAsync(targetUserId);
        return Ok(interests);
    }

    /// <summary>
    /// Follow an interest. Creates the interest if it doesn't exist yet.
    /// </summary>
    [HttpPost("{interestName}/follow")]
    [ProducesResponseType(typeof(InterestDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<InterestDto>> FollowInterest(string interestName, [FromBody] FollowInterestRequest? request = null)
    {
        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
            return Unauthorized();

        try
        {
            var result = await _interestService.FollowInterestAsync(userId, interestName, request?.DisplayName);
            return Ok(result);
        }
        catch (BadHttpRequestException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    /// <summary>
    /// Unfollow an interest.
    /// </summary>
    [HttpDelete("{interestName}/follow")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> UnfollowInterest(string interestName)
    {
        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
            return Unauthorized();

        try
        {
            await _interestService.UnfollowInterestAsync(userId, interestName);
            return NoContent();
        }
        catch (BadHttpRequestException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    /// <summary>
    /// Update subscription settings for an interest (e.g., friends-of-friends toggle).
    /// </summary>
    [HttpPatch("{interestName}/settings")]
    [ProducesResponseType(typeof(InterestDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<InterestDto>> UpdateInterestSettings(string interestName, [FromBody] UpdateInterestSettingsRequest settings)
    {
        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
            return Unauthorized();

        try
        {
            var result = await _interestService.UpdateInterestSettingsAsync(userId, interestName, settings);
            return Ok(result);
        }
        catch (BadHttpRequestException ex)
        {
            return BadRequest(ex.Message);
        }
    }
}
