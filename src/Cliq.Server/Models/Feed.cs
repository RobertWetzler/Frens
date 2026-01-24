namespace Cliq.Server.Models;

public class FeedDto
{
    public List<PostDto> Posts { get; set; } = new List<PostDto>();
    public int NotificationCount { get; set; } = 0;  // Changed to property
    public List<CirclePublicDto> UserCircles { get; set; } = new List<CirclePublicDto>();
    /// <summary>
    /// Circles created by friends that are available for subscription (IsSubscribable=true and user is not a member)
    /// </summary>
    public List<SubscribableCircleDto> AvailableSubscribableCircles { get; set; } = new List<SubscribableCircleDto>();
}