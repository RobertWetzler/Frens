namespace Cliq.Server.Models;
public class Circle
{
    public Guid Id { get; set; }
    public string Name { get; set; }
    public bool IsShared { get; set; } // If true, multiple members can post
    public Guid OwnerId { get; set; }
    public User Owner { get; set; }

    public ICollection<CircleMembership> Members { get; set; }
    public ICollection<CirclePost> Posts { get; set; }
}

public class CircleMembership
{
    public Guid CircleId { get; set; }
    public Circle Circle { get; set; }

    public Guid UserId { get; set; }
    public User User { get; set; }

    public bool IsModerator { get; set; } // Optional
}

public class CirclePost
{
    public Guid CircleId { get; set; }
    public Circle Circle { get; set; }

    public Guid PostId { get; set; }
    public Post Post { get; set; }

    public DateTime SharedAt { get; set; }
}
