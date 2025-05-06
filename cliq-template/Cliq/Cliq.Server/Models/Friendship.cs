namespace Cliq.Server.Models;

public class Friendship
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required Guid RequesterId { get; set; }
    public User Requester { get; set; }
    
    public required Guid AddresseeId { get; set; }
    public User Addressee { get; set; }
    
    public FriendshipStatus Status { get; set; } = FriendshipStatus.Pending;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? AcceptedAt { get; set; }
}

public enum FriendshipStatus
{
    Pending,
    Accepted,
    Rejected,
    Blocked
}

public class FriendshipStatusDto
{
    /// <summary>
    /// Possible values: "none", "friends", "pending_sent", "pending_received", "blocked", "blocked_by"
    /// </summary>
    public VisibleStatus Status { get; set; } = VisibleStatus.None;

    /// <summary>
    /// The friendship ID, if applicable (useful for accepting/rejecting requests)
    /// </summary>
    public Guid? FriendshipId { get; set; }
}

public enum VisibleStatus
{
    None,
    Friends,
    PendingSent,
    PendingReceived,
    Blocked,
    BlockedBy
}
