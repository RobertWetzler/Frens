using Cliq.Server.Models;
using Cliq.Server.Services;
using Cliq.Utilities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Cliq.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationTestController : ControllerBase
{
    private readonly IEventNotificationService _eventNotificationService;
    private readonly IHostEnvironment _hostEnvironment;

    public NotificationTestController(IEventNotificationService eventNotificationService, IHostEnvironment hostEnvironment)
    {
        _eventNotificationService = eventNotificationService;
        _hostEnvironment = hostEnvironment;
    }

    /// <summary>
    /// Send a test app announcement to all users
    /// </summary>
    [HttpPost("announcement")]
    public async Task<IActionResult> SendAppAnnouncement([FromBody] AppAnnouncementRequest request)
    {
        if (!_hostEnvironment.IsDevelopment())
            return NotFound();

        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
        {
            return Unauthorized();
        }

        // Only allow specific users to send announcements (you can implement proper authorization)
        // For now, just check if user exists
        if (userId == Guid.Empty)
        {
            return Unauthorized("Only administrators can send announcements");
        }

        try
        {
            await _eventNotificationService.SendAppAnnouncementAsync(
                request.Title, 
                request.Body, 
                request.ActionUrl);

            return Ok(new { success = true, message = "Announcement sent to all users" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Send a test notification to specific users
    /// </summary>
    [HttpPost("test-friend-request")]
    public async Task<IActionResult> SendTestFriendRequest([FromBody] TestFriendRequestRequest request)
    {
        if (!_hostEnvironment.IsDevelopment())
            return NotFound();

        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var requesterId))
        {
            return Unauthorized();
        }

        try
        {
            await _eventNotificationService.SendFriendRequestNotificationAsync(
                requesterId, 
                request.AddresseeId, 
                Guid.NewGuid()); // Fake friendship ID for testing

            return Ok(new { success = true, message = "Test friend request notification sent" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}

public class AppAnnouncementRequest
{
    public required string Title { get; set; }
    public required string Body { get; set; }
    public string? ActionUrl { get; set; }
}

public class TestFriendRequestRequest
{
    public required Guid AddresseeId { get; set; }
}
