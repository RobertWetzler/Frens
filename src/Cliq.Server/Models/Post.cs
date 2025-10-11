using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;
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
    // Ordered internal storage keys for optional images associated with the post.
    // Not exposed directly; clients receive only counts / booleans and must request
    // presigned URLs per image index via a dedicated endpoint.
    public List<string> ImageObjectKeys { get; set; } = new();
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
    // Indicates one or more images exist for this post. Backwards compatible naming.
    public bool HasImage { get; set; } = false;
    // Total number of images available.
    public int ImageCount { get; set; } = 0;
    // Optional short‑lived URL for a specific image index when explicitly requested.
    public string? ImageUrl { get; set; }
}

public class CreatePostDto
{
    public required string Text { get; set; }
    public Guid[] CircleIds { get; set; } = Array.Empty<Guid>();
}

// Separate request type for multipart form submissions including optional image
public class CreatePostWithImageRequest
{
    public string Text { get; set; } = string.Empty;
    public Guid[]? CircleIds { get; set; }
    // Multiple images supported; ordering preserved as received.
    public List<IFormFile>? Images { get; set; }
}

public class PostImageUrlDto
{
    public required string Url { get; set; }
    public required DateTime ExpiresAt { get; set; }
}

public class PostImageIndexedUrlDto
{
    public required int Index { get; set; }
    public required string Url { get; set; }
    public required DateTime ExpiresAt { get; set; }
}

public class PostImagesUrlDto
{
    public required Guid PostId { get; set; }
    public List<PostImageIndexedUrlDto> Images { get; set; } = new();
}