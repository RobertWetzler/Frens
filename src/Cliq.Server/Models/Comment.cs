using System.ComponentModel.DataAnnotations;

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

    public User User { get; set; } = null!;
    public Post? Post { get; set; }  // Navigation property for post parent
    public Comment? ParentComment { get; set; }  // Navigation property for comment parent
    public ICollection<Comment> Replies { get; set; } = new List<Comment>();

    // Seats reserved/claimed for a carpool comment
    public ICollection<CarpoolSeat> CarpoolSeats { get; set; } = new List<CarpoolSeat>();
}

public class CommentDto
{
    public required Guid Id { get; set; }
    public required DateTime Date { get; set; }
    public required string Text { get; set; }
    public CommentType Type { get; set; } = CommentType.Standard;

    // Carpool info (if type == Carpool)
    public int? CarpoolSpots { get; set; }
    public List<UserDto>? CarpoolRiders { get; set; } = new List<UserDto>();

    // User info
    public required UserDto User { get; set; }

    // Parent references
    //public string PostId { get; set; }

    // Optional list of replies - can be null if replies aren't loaded
    public List<CommentDto>? Replies { get; set; } = new List<CommentDto>();
    //public string? ParentCommentId { get; set; }
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
