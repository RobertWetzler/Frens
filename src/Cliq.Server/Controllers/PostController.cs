using Cliq.Server.Models;
using Cliq.Server.Services;
using Cliq.Utilities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Cliq.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PostController : ControllerBase
{
    private readonly IPostService _postService;

    public PostController(IPostService postService)
    {
        _postService = postService;
    }

    // Dedicated endpoint to fetch a short-lived image URL. Keeps feed lightweight while
    // allowing on-demand fetching. Client may batch or call only for in-view posts.
    [HttpGet("{id}/image")]
    [Produces("application/json")]
    [ProducesResponseType(typeof(PostImageUrlDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<PostImageUrlDto>> GetPostImage(Guid id, int index = 0, int expirySeconds = 60)
    {
        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
        {
            return Unauthorized();
        }
        if (expirySeconds > 3600)
        {
            return BadRequest("Expiry must be less than 1 hour");
        }
        if (index < 0)
        {
            return BadRequest("Index must be >= 0");
        }
        var url = await _postService.GetPostImageUrlAsync(userId, id, index, expirySeconds);
        if (url == null)
        {
            return NotFound();
        }
        return Ok(new PostImageUrlDto { Url = url, ExpiresAt = DateTime.UtcNow.AddSeconds(expirySeconds) });
    }

    // Batch endpoint: /api/post/{id}/images?indices=0,1,2
    [HttpGet("{id}/images")]
    [ProducesResponseType(typeof(PostImagesUrlDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<PostImagesUrlDto>> GetPostImages(Guid id, [FromQuery] List<int>? indices = null, int expirySeconds = 60)
    {
        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
        {
            return Unauthorized();
        }
        if (expirySeconds > 3600)
        {
            return BadRequest("Expiry must be less than 1 hour");
        }
        if (indices == null || indices.Count == 0)
        {
            // If none specified, default to first (0)
            indices = new List<int> { 0 };
        }
        else
        {
            foreach (var idx in indices)
            {
                if (idx < 0)
                {
                    return BadRequest($"Invalid index: {idx}");
                }
            }
        }
        var urls = await _postService.GetPostImageUrlsAsync(userId, id, indices, expirySeconds);
        if (urls.Count == 0)
        {
            return NotFound();
        }
        return Ok(new PostImagesUrlDto
        {
            PostId = id,
            Images = urls.Select(kvp => new PostImageIndexedUrlDto
            {
                Index = kvp.Key,
                Url = kvp.Value,
                ExpiresAt = DateTime.UtcNow.AddSeconds(expirySeconds)
            }).OrderBy(i => i.Index).ToList()
        });
    }

    // TODO: validate user has permissions to view post
    [HttpGet("{id}")]
    public async Task<ActionResult<PostDto>> GetPost(Guid id, bool includeCommentTree = true, bool includeImageUrl = false)
    {
        if(!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
        {
            return Unauthorized();
        }
        var post = await _postService.GetPostByIdAsync(userId, id, includeCommentTree, includeImageUrl: includeImageUrl);
        if (post == null)
        {
            return NotFound();
        }
        return Ok(post);
    }

    [HttpGet("feed")]
    public async Task<ActionResult<FeedDto>> GetFeed()
    {
        return await GetFeedWithPaging(1, 20);
    }

    [HttpGet("feed/paged")]
    public async Task<ActionResult<FeedDto>> GetFeedWithPaging(int page, int pageSize = 50)
    {
        var idClaim = this.HttpContext.User.Claims.FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");
        Guid userId;
        if (idClaim == null || !Guid.TryParse(idClaim.Value, out userId))
        {
            return Unauthorized();
        }
        var feed = await _postService.GetFeedForUserAsync(userId, page, pageSize);
        return Ok(feed);
    }

    [HttpGet("feed/filtered")]
    public async Task<ActionResult<FeedDto>> GetFilteredFeed(int page = 1, int pageSize = 50, [FromQuery] string? circleIds = null)
    {
        var idClaim = this.HttpContext.User.Claims.FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");
        Guid userId;
        if (idClaim == null || !Guid.TryParse(idClaim.Value, out userId))
        {
            return Unauthorized();
        }

        // Parse circle IDs if provided
        Guid[]? circleIdArray = null;
        if (!string.IsNullOrEmpty(circleIds))
        {
            var circleIdStrings = circleIds.Split(',');
            circleIdArray = new Guid[circleIdStrings.Length];
            for (int i = 0; i < circleIdStrings.Length; i++)
            {
                if (!Guid.TryParse(circleIdStrings[i], out circleIdArray[i]))
                {
                    return BadRequest($"Invalid circle ID: {circleIdStrings[i]}");
                }
            }
        }

        var feed = await _postService.GetFilteredFeedForUserAsync(userId, circleIdArray, page, pageSize);
        return Ok(feed);
    }

    [HttpPost]
    [RequestSizeLimit(50_000_000)] // ~25MB limit (adjust as needed)
    [Consumes("multipart/form-data", "application/json")]
    public async Task<ActionResult<PostDto>> CreatePost([FromForm] CreatePostWithImageRequest request)
    {
        var idClaim = this.HttpContext.User.Claims.FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");
        if (idClaim == null)
        {
            return Unauthorized();
        }
        var imageKeys = new List<string>();
        if (request.Images != null && request.Images.Count > 0)
        {
            var allowed = new [] { "image/png", "image/jpeg", "image/heic", "image/webp" };
            long totalBytes = 0;
            var storage = HttpContext.RequestServices.GetService<IObjectStorageService>();
            var imageProcessor = HttpContext.RequestServices.GetService<IImageProcessingService>();
            if (storage == null)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, "Storage service not available");
            }
            if (imageProcessor == null)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, "Image processing service not available");
            }
            foreach (var img in request.Images)
            {
                if (img == null || img.Length == 0) continue;
                if (!allowed.Contains(img.ContentType))
                {
                    return BadRequest($"Unsupported image content type: {img.ContentType}");
                }
                if (img.Length > 25_000_000)
                {
                    return BadRequest($"Single image too large (>25MB): {img.FileName}");
                }
                // Process & compress
                await using var originalStream = img.OpenReadStream();
                var (processedStream, outputContentType) = await imageProcessor.ProcessAsync(originalStream, img.ContentType, maxWidth: 1920, maxHeight: 1920, preferredMaxBytes: 1_000_000);
                // Update aggregate bytes using resulting size, not input size
                totalBytes += processedStream.Length;
                if (totalBytes > 50_000_000) // overall cap ~50MB
                {
                    return BadRequest("Total images payload too large (>50MB)");
                }
                var key = await storage.UploadPostImageAsync(new Guid(idClaim.Value), processedStream, outputContentType);
                imageKeys.Add(key);
            }
        }
        var createdPost = await _postService.CreatePostAsync(new Guid(idClaim.Value), request.CircleIds ?? Array.Empty<Guid>(), request.Text, imageKeys);
        return CreatedAtAction(nameof(GetPost), new { id = createdPost.Id }, createdPost);
    }
    // TODO: Authorize userId matches that of postId
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdatePost(Guid id, string newText)
    {
        var idClaim = this.HttpContext.User.Claims.FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");
        if (idClaim == null)
        {
            return Unauthorized();
        }
        var updatedPost = await _postService.UpdatePostAsync(id, new Guid(idClaim.Value), newText);
        if (updatedPost == null)
        {
            return NotFound();
        }

        return NoContent();
    }

    // TODO: Authorize userId matches that of postId
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeletePost(Guid id)
    {
        var idClaim = this.HttpContext.User.Claims.FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");
        if (idClaim == null)
        {
            return Unauthorized();
        }
        var result = await _postService.DeletePostAsync(id, new Guid(idClaim.Value));
        if (!result)
        {
            return NotFound();
        }

        return NoContent();
    }
}