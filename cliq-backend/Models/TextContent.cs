namespace CliqBackend.Models;

public class TextContent : IPostContent
{
    public required string Text { get; set; }
}