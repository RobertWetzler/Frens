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

// Used for representing friendship on a user's profile, very minimal
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

// Used for representing an friend request (e.g. in notifications screen) including data about the user
public class FriendRequestDto
{
    /// <summary>
    /// Possible values: "none", "friends", "pending_sent", "pending_received", "blocked", "blocked_by"
    /// </summary>
    public VisibleStatus Status { get; set; } = VisibleStatus.None;

    /// <summary>
    /// The friendship ID, if applicable (useful for accepting/rejecting requests)
    /// </summary>
    public required Guid Id { get; set; }

    public required Guid RequesterId { get; set; }
    public UserDto? Requester { get; set; } = null;

    public required Guid AddresseeId { get; set; }
    public UserDto? Addressee { get; set; } = null;

    public DateTime CreatedAt { get; set; }

    public DateTime? AcceptedAt { get; set; } = null;
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
