using System.ComponentModel.DataAnnotations;

namespace Cliq.Server.Models;

public class Comment
{
    public required string Id { get; set; }
    public required string UserId { get; set; }
    // Parent ID can reference either a post or a comment
    public required string ParentId { get; set; }
    public required DateTime Date { get; set; }
    [MaxLength(4000)]
    public required string Text { get; set; }
    public User User { get; set; } = null!;
}
