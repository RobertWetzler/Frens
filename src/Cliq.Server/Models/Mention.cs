namespace Cliq.Server.Models;

/// <summary>
/// Represents a mention of a user in post/comment text.
/// Contains the user ID and the position of the mention in the text.
/// </summary>
public class MentionDto
{
    /// <summary>
    /// The ID of the mentioned user
    /// </summary>
    public required Guid UserId { get; set; }
    
    /// <summary>
    /// The display name used in the mention (for validation)
    /// </summary>
    public required string Name { get; set; }
    
    /// <summary>
    /// The start position of the mention in the text (character index, starting at @)
    /// </summary>
    public required int Start { get; set; }
    
    /// <summary>
    /// The end position of the mention in the text (character index, exclusive)
    /// </summary>
    public required int End { get; set; }
}

/// <summary>
/// Request DTO for creating a post with mentions
/// </summary>
public class CreatePostWithMentionsRequest
{
    public string Text { get; set; } = string.Empty;
    public Guid[] CircleIds { get; set; } = Array.Empty<Guid>();
    public Guid[] UserIds { get; set; } = Array.Empty<Guid>();
    public List<MentionDto> Mentions { get; set; } = new();
}

/// <summary>
/// Request DTO for creating a comment with mentions
/// </summary>
public class CreateCommentWithMentionsDto
{
    public required string Text { get; set; }
    public Guid? ParentCommentId { get; set; }
    public List<MentionDto> Mentions { get; set; } = new();
}

/// <summary>
/// DTO representing a user that can be mentioned (for dropdown population)
/// </summary>
public class MentionableUserDto
{
    public required Guid Id { get; set; }
    public required string Name { get; set; }
    public string? ProfilePictureUrl { get; set; }
}
