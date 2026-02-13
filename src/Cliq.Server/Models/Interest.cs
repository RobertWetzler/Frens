namespace Cliq.Server.Models;

/// <summary>
/// A topic/interest tag that flows through the social graph.
/// No owner - anyone can post to any interest.
/// Unlike Circles, Interests spread organically as friends discover
/// what their friends are posting about.
/// </summary>
public class Interest
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Normalized name: lowercase, no spaces, no special chars except underscore.
    /// Examples: "hellokitty", "seattle_climbing", "recipes"
    /// </summary>
    public required string Name { get; set; }

    /// <summary>
    /// Display name with original casing for UI.
    /// Examples: "HelloKitty", "Seattle Climbing", "Recipes"
    /// </summary>
    public required string DisplayName { get; set; }

    /// <summary>
    /// When this interest was first used in the system.
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// User who first posted to this interest (for attribution, not ownership).
    /// </summary>
    public Guid? CreatedByUserId { get; set; }
    public User? CreatedByUser { get; set; }

    public ICollection<InterestSubscription> Subscribers { get; set; } = new List<InterestSubscription>();
    public ICollection<InterestPost> Posts { get; set; } = new List<InterestPost>();
}

/// <summary>
/// User's subscription to an interest.
/// Controls what interests show in their feed.
/// </summary>
public class InterestSubscription
{
    public Guid InterestId { get; set; }
    public Interest? Interest { get; set; }

    public Guid UserId { get; set; }
    public User? User { get; set; }

    /// <summary>
    /// When the user followed this interest.
    /// </summary>
    public DateTime SubscribedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// If true, see friends-of-friends posts for this interest.
    /// Default is false (direct friends only).
    /// </summary>
    public bool IncludeFriendsOfFriends { get; set; } = false;
}

/// <summary>
/// Links a post to an interest (many-to-many).
/// A post can be shared to multiple interests AND circles simultaneously.
/// </summary>
public class InterestPost
{
    public Guid InterestId { get; set; }
    public Interest? Interest { get; set; }

    public Guid PostId { get; set; }
    public Post? Post { get; set; }

    public DateTime SharedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// If true, this post was announced to all friends when posted
    /// (used for "new interest" announcements).
    /// </summary>
    public bool WasAnnounced { get; set; } = false;
}

/// <summary>
/// Tracks interest announcements to rate-limit spam.
/// Users can only announce a new interest to their friends periodically.
/// </summary>
public class InterestAnnouncement
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }
    public User? User { get; set; }

    public Guid InterestId { get; set; }
    public Interest? Interest { get; set; }

    /// <summary>
    /// When this announcement was made.
    /// </summary>
    public DateTime AnnouncedAt { get; set; } = DateTime.UtcNow;
}

// ========== DTOs ==========

public class InterestDto
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public required string DisplayName { get; set; }
    /// <summary>
    /// Number of the current user's friends who follow this interest.
    /// </summary>
    public int FriendsFollowingCount { get; set; }
    /// <summary>
    /// Whether the current user follows this interest.
    /// </summary>
    public bool IsFollowing { get; set; }
    /// <summary>
    /// Whether to include friends-of-friends posts for this interest.
    /// </summary>
    public bool IncludeFriendsOfFriends { get; set; }
}

/// <summary>
/// Lightweight DTO for interest suggestions/autocomplete.
/// </summary>
public class InterestSuggestionDto
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public required string DisplayName { get; set; }
    /// <summary>
    /// Number of the current user's friends using this interest.
    /// </summary>
    public int FriendsUsingCount { get; set; }
}

/// <summary>
/// DTO for following/unfollowing an interest.
/// </summary>
public class FollowInterestRequest
{
    /// <summary>
    /// The display name to use if creating a new interest.
    /// </summary>
    public string? DisplayName { get; set; }
}

/// <summary>
/// DTO for updating interest subscription settings.
/// </summary>
public class UpdateInterestSettingsRequest
{
    public bool IncludeFriendsOfFriends { get; set; }
}

/// <summary>
/// Simple DTO for interests attached to posts.
/// </summary>
public class InterestPublicDto
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public required string DisplayName { get; set; }
}
