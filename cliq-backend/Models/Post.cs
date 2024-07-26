using System.ComponentModel.DataAnnotations;

namespace CliqBackend.Models;
public class Post
{
    public required string Id { get; set; }
    public required string UserId { get; set; }
    public required DateTime Date { get; set; }
    [MaxLength(4000)]
    public required string Text { get; set; }
    public required User User { get; set; }

    public ICollection<User> Viewers { get; set; } = new List<User>();
}
