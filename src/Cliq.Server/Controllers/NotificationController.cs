using Cliq.Server.Models;
using Cliq.Server.Services;
using Cliq.Server.Store;
using Cliq.Utilities;
using Microsoft.AspNetCore.Mvc;

namespace Cliq.Server.Controllers;

[Route("api/[controller]")]
[ApiController]
public class NotificationController : ControllerBase
{
    private readonly INotificationService _notificationService;
    private readonly IPushSubscriptionStore _subscriptionStore;
    public NotificationController(INotificationService notificationService, IPushSubscriptionStore subscriptionStore)
    {
        _subscriptionStore = subscriptionStore;
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

    [HttpPost("subscriptions")]
    public async Task<IActionResult> StoreSubscription([FromBody]PushSubscriptionDto subscription)
    {
        if(!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
        {
            return Unauthorized();
        }

        await _subscriptionStore.StoreSubscriptionAsync(userId, subscription);

        return NoContent();
    }
}