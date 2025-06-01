using Cliq.Server.Models;
using Microsoft.Extensions.Options;
using Lib.Net.Http.WebPush;
namespace Cliq.Server.Services;

public interface INotificationService
{
    Task<NotificationDto> GetNotifications(Guid userId);
}

public class NotificationService : INotificationService
{
    IFriendshipService _friendshipService;
    public NotificationService(IFriendshipService friendshipService)
    {
        _friendshipService = friendshipService;
    }

    // TODO: Implement other notification types (e.g. mentions, comments, etc.)
    public async Task<NotificationDto> GetNotifications(Guid userId)
    {
        var friendRequests = await _friendshipService.GetFriendRequestsAsync(userId);
        return new NotificationDto
        {
            friendRequests = friendRequests
        };
    }
}
