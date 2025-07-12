namespace Cliq.Server.Models;

public class FeedDto
{
    public List<PostDto> Posts { get; set; } = new List<PostDto>();
    public int NotificationCount { get; set; } = 0;  // Changed to property
    public List<CirclePublicDto> UserCircles { get; set; } = new List<CirclePublicDto>();
}