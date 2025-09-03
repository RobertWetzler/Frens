namespace Cliq.Server.Models;

public class CalendarSubscription
{
    public required Guid Id { get; set; }
    public required Guid UserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}