using Cliq.Server.Models;

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
public class NotificationDto
{
    public IEnumerable<FriendRequestDto> friendRequests { get; set; }
}