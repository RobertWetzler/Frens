using System.ComponentModel.DataAnnotations;

namespace Cliq.Server.Models;

public class Post
{
    public required string Id { get; set; }
    public required string UserId { get; set; }
    public required DateTime Date { get; set; }
    [MaxLength(4000)]
    public required string Text { get; set; }
    public User User { get; set; } = null!;
    public ICollection<Comment> Comments { get; set; } = new List<Comment>();
    public ICollection<User> Viewers { get; set; } = new List<User>();
}

public class PostDto
{
    public required string Id { get; set; }
    public required string UserId { get; set; }
    public required DateTime Date { get; set; }
    public required string Text { get; set; }
    public UserDto User { get; set; } = null!;
    public List<CommentDto> Comments { get; set; } = new List<CommentDto>(); 
}