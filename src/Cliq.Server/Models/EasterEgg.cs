namespace Cliq.Server.Models;

/// <summary>
/// Represents an easter egg that has been discovered by a user
/// </summary>
public class EasterEgg
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    /// <summary>
    /// The user who discovered the easter egg
    /// </summary>
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    
    /// <summary>
    /// Unique identifier for the type of easter egg (e.g., "snowman_dance", "pumpkin_spin")
    /// </summary>
    public required string EasterEggId { get; set; }
    
    /// <summary>
    /// When the easter egg was first discovered by this user
    /// </summary>
    public DateTime DiscoveredAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// DTO for easter egg data
/// </summary>
public class EasterEggDto
{
    public required string EasterEggId { get; set; }
    public DateTime DiscoveredAt { get; set; }
}
