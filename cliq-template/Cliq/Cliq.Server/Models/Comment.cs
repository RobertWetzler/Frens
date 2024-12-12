using System.ComponentModel.DataAnnotations;

namespace Cliq.Server.Models;

public class Comment
{
    public required string Id { get; set; }
    public required string UserId { get; set; }
    public required string PostId { get; set; }  // Always set to the root post's ID
    public string? ParentCommentId { get; set; }  // If this is set, it's a reply to another comment
    public required DateTime Date { get; set; }
    [MaxLength(4000)]
    public required string Text { get; set; }

    public User User { get; set; } = null!;
    public Post? Post { get; set; }  // Navigation property for post parent
    public Comment? ParentComment { get; set; }  // Navigation property for comment parent
    public ICollection<Comment> Replies { get; set; } = new List<Comment>();
}

public class CommentDto
{
    public required string Id { get; set; }
    public required DateTime Date { get; set; }
    public required string Text { get; set; }

    // User info
    public required UserDto User { get; set; }

    // Parent references
    //public string PostId { get; set; }

    // Optional list of replies - can be null if replies aren't loaded
    public List<CommentDto>? Replies { get; set; } = new List<CommentDto>();
    //public string? ParentCommentId { get; set; }
}
