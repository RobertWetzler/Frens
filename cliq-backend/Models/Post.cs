namespace CliqBackend.Models;
public class Post
{
    public required string Id { get; set; }
    public required User User { get; set; }
    public required DateTime Date { get; set; }
    public required string Type { get; set; }
    public required IPostContent Content { get; set; }
}
