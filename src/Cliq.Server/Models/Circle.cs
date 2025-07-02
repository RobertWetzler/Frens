namespace Cliq.Server.Models;
public class Circle
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public bool IsShared { get; set; } // If true, multiple members can post
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

public class CirclePost
{
    public Guid CircleId { get; set; }
    public Circle? Circle { get; set; }

    public Guid PostId { get; set; }
    public Post? Post { get; set; }

    public DateTime SharedAt { get; set; }
}

public class CirclePublicDto
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public bool IsShared { get; set; }
    public bool IsOwner {get; set; } = false;
}

public class CircleWithMembersDto
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public bool IsShared { get; set; }
    public bool IsOwner { get; set; } = false;
    public UserDto? Owner { get; set; }
    public List<UserDto> Members { get; set; } = new List<UserDto>();
}

public class CircleCreationDto
{
    public required string Name { get; set; }
    public required bool IsShared { get; set; } // If true, multiple members can post
    public Guid[] UserIdsToAdd { get; set; } = Array.Empty<Guid>();
}