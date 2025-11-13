namespace Cliq.Server.Models;

/// <summary>
/// Tracks user activity for metrics and analytics
/// </summary>
public class UserActivity
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public DateTime ActivityDate { get; set; }
    public UserActivityType ActivityType { get; set; }
}

/// <summary>
/// Types of user activities to track
/// </summary>
public enum UserActivityType
{
    PostCreated,
    CommentCreated,
    FeedLoaded
}
