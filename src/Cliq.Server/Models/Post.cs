using System.ComponentModel.DataAnnotations;
using System.Runtime.Serialization;
using System.Text.Json.Serialization;

namespace Cliq.Server.Models;

// Polymorphism for System.Text.Json & Swashbuckle
[JsonPolymorphic(TypeDiscriminatorPropertyName = "discriminator")]
[JsonDerivedType(typeof(Event), typeDiscriminator: "Event")]
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
    public ICollection<CirclePost> SharedWithCircles { get; set; } = new List<CirclePost>();
}

// Polymorphism for DTOs
[JsonPolymorphic(TypeDiscriminatorPropertyName = "discriminator")]
[JsonDerivedType(typeof(EventDto), typeDiscriminator: "Event")]
public class PostDto
{
    public required Guid Id { get; set; }
    public required Guid UserId { get; set; }
    public required DateTime Date { get; set; }
    public required string Text { get; set; }
    public UserDto User { get; set; } = null!;
    public List<CommentDto> Comments { get; set; } = new List<CommentDto>();
    public List<CirclePublicDto> SharedWithCircles { get; set; } = new List<CirclePublicDto>();
    public int CommentCount { get; set; } = 0;
}

public class CreatePostDto
{
    public required string Text { get; set; }
    public Guid[] CircleIds { get; set; } = Array.Empty<Guid>();
}