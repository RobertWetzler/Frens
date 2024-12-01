namespace Cliq.Server.Models;

public class User
{
    public required string Id { get; set; }
    public required string Name { get; set; }
    public required string Email { get; set; }
    public required string Password { get; set; }
    public required string Username { get; set;}
}

public class UserDto
{
    public required string Id { get; set; }
    public required string Name { get; set; }
    public required string Username { get; set; }
}
