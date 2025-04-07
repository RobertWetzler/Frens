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
}

public class UserDto
{
    public required string Id { get; set; }
    public required string Name { get; set; }
}