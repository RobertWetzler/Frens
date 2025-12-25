using Cliq.Server.Data;
using Cliq.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Cliq.Server.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class EasterEggController : ControllerBase
{
    private readonly CliqDbContext _context;
    private readonly ILogger<EasterEggController> _logger;

    public EasterEggController(CliqDbContext context, ILogger<EasterEggController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Record that the current user has discovered an easter egg
    /// </summary>
    /// <param name="request">The easter egg discovery request containing the easter egg ID</param>
    /// <returns>The easter egg discovery record with timestamp</returns>
    /// <remarks>
    /// This endpoint is idempotent - discovering the same easter egg multiple times will return the existing record.
    /// Each user can only discover each unique easter egg once.
    /// </remarks>
    [HttpPost("discover")]
    public async Task<ActionResult<EasterEggDto>> DiscoverEasterEgg([FromBody] DiscoverEasterEggRequest request)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // Check if user has already discovered this easter egg
        var existing = await _context.EasterEggs
            .FirstOrDefaultAsync(e => e.UserId == userId && e.EasterEggId == request.EasterEggId);

        if (existing != null)
        {
            // Already discovered, just return the existing one
            return Ok(new EasterEggDto
            {
                EasterEggId = existing.EasterEggId,
                DiscoveredAt = existing.DiscoveredAt
            });
        }

        // Create new discovery
        var easterEgg = new EasterEgg
        {
            UserId = userId,
            EasterEggId = request.EasterEggId,
            DiscoveredAt = DateTime.UtcNow
        };

        _context.EasterEggs.Add(easterEgg);
        await _context.SaveChangesAsync();

        _logger.LogInformation("User {UserId} discovered easter egg {EasterEggId}", userId, request.EasterEggId);

        return Ok(new EasterEggDto
        {
            EasterEggId = easterEgg.EasterEggId,
            DiscoveredAt = easterEgg.DiscoveredAt
        });
    }

    /// <summary>
    /// Get all easter eggs discovered by the current user or a specific user
    /// </summary>
    /// <param name="userId">Optional user ID. If not provided, returns easter eggs for the current user</param>
    /// <returns>List of discovered easter eggs ordered by discovery date</returns>
    [HttpGet]
    public async Task<ActionResult<List<EasterEggDto>>> GetDiscoveredEasterEggs([FromQuery] Guid? userId = null)
    {
        var targetUserId = userId ?? Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var easterEggs = await _context.EasterEggs
            .Where(e => e.UserId == targetUserId)
            .OrderBy(e => e.DiscoveredAt)
            .Select(e => new EasterEggDto
            {
                EasterEggId = e.EasterEggId,
                DiscoveredAt = e.DiscoveredAt
            })
            .ToListAsync();

        return Ok(easterEggs);
    }
}

public class DiscoverEasterEggRequest
{
    public required string EasterEggId { get; set; }
}
