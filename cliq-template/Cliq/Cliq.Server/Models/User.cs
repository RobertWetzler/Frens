using Microsoft.AspNetCore.Identity;

namespace Cliq.Server.Models;

public class User : IdentityUser
{
    public User(string userName) : base(userName)
    {
    }
    public User() : base()
    {
    }
    public required string Name { get; set; }
    public string Bio { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLogin { get; set; }
    public ICollection<Friendship> FriendRequestsSent { get; set; } = new List<Friendship>();
    public ICollection<Friendship> FriendRequestsReceived { get; set; } = new List<Friendship>();
}

public class UserDto
{
    public required string Id { get; set; }
    public required string Name { get; set; }
}

public class UserProfileDto
{
    public required string Id { get; set; }
    public required string Name { get; set; }
    public string Bio { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}