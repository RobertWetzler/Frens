using Microsoft.AspNetCore.Identity;

namespace Cliq.Server.Models;

public class User : IdentityUser<Guid>
{
    public User(string userName) : base(userName)
    {
        Id = Guid.NewGuid();
    }
    public User() : base()
    {
        Id = Guid.NewGuid();
    }
    public required string Name { get; set; }
    public string Bio { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLogin { get; set; }
    public ICollection<Friendship> FriendRequestsSent { get; set; } = new List<Friendship>();
    public ICollection<Friendship> FriendRequestsReceived { get; set; } = new List<Friendship>();
    public ICollection<Circle> OwnedCircles { get; set; }
}

public class UserDto
{
    public required Guid Id { get; set; }
    public required string Name { get; set; }
}

public class UserProfileDto
{
    public required Guid Id { get; set; }
    public required string Name { get; set; }
    public string Bio { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}