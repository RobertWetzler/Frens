using System.ComponentModel.DataAnnotations;

namespace Cliq.Server.Models;

public class Post
{
    public Post() => Id = Guid.NewGuid();

    public required Guid Id { get; set; }
    public required Guid UserId { get; set; }
    public required DateTime Date { get; set; }
    [MaxLength(4000)]
    public required string Text { get; set; }
    public User User { get; set; } = null!;
    public ICollection<Comment> Comments { get; set; } = new List<Comment>();
    public ICollection<User> Viewers { get; set; } = new List<User>();
    public ICollection<CirclePost> SharedWithCircles { get; set; } = new List<CirclePost>();
}

public class PostDto
{
    public required Guid Id { get; set; }
    public required Guid UserId { get; set; }
    public required DateTime Date { get; set; }
    public required string Text { get; set; }
    public UserDto User { get; set; } = null!;
    public List<CommentDto> Comments { get; set; } = new List<CommentDto>();
    public int CommentCount { get; set; } = 0;
}