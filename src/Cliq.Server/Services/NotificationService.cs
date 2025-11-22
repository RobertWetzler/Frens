using Cliq.Server.Models;
using Microsoft.Extensions.Options;
using Lib.Net.Http.WebPush;
using Cliq.Server.Data;
using Microsoft.EntityFrameworkCore;
using AutoMapper;
namespace Cliq.Server.Services;

public interface INotificationService
{
    Task<NotificationFeedDto> GetNotifications(Guid userId);
}

public class NotificationService : INotificationService
{
    IFriendshipService _friendshipService;
    private readonly CliqDbContext _dbContext;
    private readonly IMapper _mapper;


    public NotificationService(IFriendshipService friendshipService, CliqDbContext dbContext, IMapper mapper)
    {
        _friendshipService = friendshipService;
        _dbContext = dbContext;
        _mapper = mapper;
    }

    public async Task<NotificationFeedDto> GetNotifications(Guid userId)
    {
        var friendRequests = await _friendshipService.GetFriendRequestsAsync(userId);

        // Get all recent notifications
        var notifications = await _dbContext.Notifications
            .Where(n => n.UserId == userId )
            .OrderByDescending(n => n.CreatedAt)
            .ToListAsync();

        // SUPER FREAKING HACKY, filter using JSONB or derive these subscribable circles from the circleservice directly
        notifications = notifications.FindAll(n => n.Metadata != null && n.Metadata.Contains("NewSubscribableCircle"));
        var notificationDtos = _mapper.Map<IEnumerable<NotificationDto>>(notifications);

        return new NotificationFeedDto
        {
            friendRequests = friendRequests,
            notifications = notificationDtos
        };
    }
}
