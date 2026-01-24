namespace Cliq.Server.Models;
public class Circle
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public bool IsShared { get; set; } // If true, multiple members can post
    public bool IsSubscribable { get; set; } // If true, users can subscribe to the circle
    public Guid OwnerId { get; set; }
    public User? Owner { get; set; }

    public ICollection<CircleMembership> Members { get; set; } = new List<CircleMembership>();
    public ICollection<CirclePost> Posts { get; set; } = new List<CirclePost>();
}

// Helper class to avoid duplicates when combining circles
public class CircleIdComparer : IEqualityComparer<CirclePublicDto>
{
    public bool Equals(CirclePublicDto? x, CirclePublicDto? y)
    {
        if (x == null || y == null)
            return false;
        
        return x.Id == y.Id;
    }
    
    public int GetHashCode(CirclePublicDto obj)
    {
        return obj.Id.GetHashCode();
    }
}

public class CircleMembership
{
    public Guid CircleId { get; set; }
    public Circle? Circle { get; set; }

    public Guid UserId { get; set; }
    public User? User { get; set; }

    public bool IsModerator { get; set; } // Optional
}

public class CirclePublicDto
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public bool IsShared { get; set; }
    public bool IsSubscribable { get; set; }
    public bool IsOwner {get; set; } = false;
    /// <summary>
    /// Users that can be mentioned when posting to this circle.
    /// For owned circles: all members. For member circles: the owner.
    /// </summary>
    public List<MentionableUserDto> MentionableUsers { get; set; } = new();
}

public class CircleWithMembersDto
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public bool IsShared { get; set; }
    public bool IsSubscribable { get; set; }
    public bool IsOwner { get; set; } = false;
    public UserDto? Owner { get; set; }
    public List<UserDto> Members { get; set; } = new List<UserDto>();
}

public class CircleCreationDto
{
    public required string Name { get; set; }
    public required bool IsShared { get; set; } // If true, multiple members can post
    public bool IsSubscribable { get; set; } = false;
    public Guid[] UserIdsToAdd { get; set; } = Array.Empty<Guid>();
}

/// <summary>
/// DTO for circles available for subscription (created by friends with IsSubscribable=true)
/// </summary>
public class SubscribableCircleDto
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public required UserDto Owner { get; set; }
}