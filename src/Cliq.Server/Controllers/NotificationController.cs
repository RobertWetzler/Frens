using Cliq.Server.Services;
using Cliq.Utilities;
using Microsoft.AspNetCore.Mvc;

namespace Cliq.Server.Controllers;

[Route("api/[controller]")]
[ApiController]
public class NotificationController : ControllerBase
{
    public INotificationService _notificationService;
    public NotificationController(INotificationService notificationService)
    {
        _notificationService = notificationService;
    }

    [HttpGet]
    public async Task<ActionResult<NotificationDto>> GetNotifications()
    {
        if (!AuthUtils.TryGetUserIdFromToken(this.HttpContext, out var userId))
        {
            return Unauthorized();
        }
        return Ok(await _notificationService.GetNotifications(userId));
    }
}