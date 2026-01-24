using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace Cliq.Server.Models;

public class Comment
{
    public required Guid Id { get; set; }
    public required Guid UserId { get; set; }
    public required Guid PostId { get; set; }  // Always set to the root post's ID
    public Guid? ParentCommentId { get; set; }  // If this is set, it's a reply to another comment
    public required DateTime Date { get; set; }
    [MaxLength(4000)]
    public required string Text { get; set; }

    // Comment type: standard text comment or carpool announcement
    public CommentType Type { get; set; } = CommentType.Standard;

    // If this comment is a carpool announcement, optional number of spots
    public int? CarpoolSpots { get; set; }

    // Mentions stored as JSON - contains userId, name, start, end positions
    public List<MentionDto> Mentions { get; set; } = new();

    public User User { get; set; } = null!;
    public Post? Post { get; set; }  // Navigation property for post parent
    public Comment? ParentComment { get; set; }  // Navigation property for comment parent
    public ICollection<Comment> Replies { get; set; } = new List<Comment>();

    // Seats reserved/claimed for a carpool comment
    public ICollection<CarpoolSeat> CarpoolSeats { get; set; } = new List<CarpoolSeat>();
}

// Polymorphism for DTOs - carpool comments get their own derived type with additional fields
[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(CommentDto), typeDiscriminator: "Standard")]
[JsonDerivedType(typeof(CarpoolCommentDto), typeDiscriminator: "Carpool")]
public class CommentDto
{
    public required Guid Id { get; set; }
    public required DateTime Date { get; set; }
    public required string Text { get; set; }

    // User info
    public required UserDto User { get; set; }

    // Mentions in the comment text with user IDs and positions
    public List<MentionDto> Mentions { get; set; } = new List<MentionDto>();

    // Optional list of replies - can be null if replies aren't loaded
    public List<CommentDto>? Replies { get; set; } = new List<CommentDto>();
}

/// <summary>
/// DTO for carpool announcement comments - includes carpool-specific fields
/// </summary>
public class CarpoolCommentDto : CommentDto
{
    public int? CarpoolSpots { get; set; }
    public List<UserDto> CarpoolRiders { get; set; } = new List<UserDto>();
}

public enum CommentType
{
    Standard = 0,
    Carpool = 1
}

public class CarpoolSeat
{
    public required Guid Id { get; set; }
    public required Guid CommentId { get; set; }
    public required Guid UserId { get; set; }
    public required DateTime ReservedAt { get; set; }

    public Comment? Comment { get; set; }
    public User? User { get; set; }
}

// Request objects for comment creation - enables unified code path
public record CreateCommentRequest(
    string Text,
    Guid UserId,
    Guid PostId,
    Guid? ParentCommentId = null,
    List<MentionDto>? Mentions = null
)
{
    /// <summary>
    /// Override in derived types to set the comment type
    /// </summary>
    public virtual CommentType CommentType => CommentType.Standard;

    /// <summary>
    /// Apply type-specific properties to the comment entity
    /// </summary>
    public virtual void ApplyTo(Comment comment)
    {
        comment.Type = CommentType;
    }
}

public record CreateCarpoolCommentRequest(
    string Text,
    Guid UserId,
    Guid PostId,
    int Spots,
    Guid? ParentCommentId = null,
    List<MentionDto>? Mentions = null
) : CreateCommentRequest(Text, UserId, PostId, ParentCommentId, Mentions)
{
    public override CommentType CommentType => CommentType.Carpool;

    public override void ApplyTo(Comment comment)
    {
        base.ApplyTo(comment);
        comment.CarpoolSpots = Spots;
    }
}

/// <summary>
/// Request DTO for creating a comment via API (JSON body)
/// </summary>
public class CreateCommentRequestDto
{
    public required string Text { get; set; }
    public required Guid PostId { get; set; }
    public Guid? ParentCommentId { get; set; }
    public List<MentionDto>? Mentions { get; set; }
}

/// <summary>
/// Request DTO for creating a carpool comment via API (JSON body)
/// </summary>
public class CreateCarpoolCommentRequestDto
{
    public required string Text { get; set; }
    public required Guid PostId { get; set; }
    public int Spots { get; set; } = 1;
    public Guid? ParentCommentId { get; set; }
    public List<MentionDto>? Mentions { get; set; }
}
