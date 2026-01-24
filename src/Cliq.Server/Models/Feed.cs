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
    /// <summary>
    /// Users recommended as potential friends based on mutual connections.
    /// These are people who share friends with you but are not yet connected.
    /// </summary>
    public List<RecommendedFriendDto> RecommendedFriends { get; set; } = new List<RecommendedFriendDto>();
}