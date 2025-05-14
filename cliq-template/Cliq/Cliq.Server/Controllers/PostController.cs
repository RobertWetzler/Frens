using Cliq.Server.Models;
using Cliq.Server.Services;
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

    // TODO: validate user has permissions to view post
    [HttpGet("{id}")]
    public async Task<ActionResult<PostDto>> GetPost(Guid id, bool includeCommentTree = true)
    {
        var post = await _postService.GetPostByIdAsync(id, includeCommentTree);
        if (post == null)
        {
            return NotFound();
        }
        return Ok(post);
    }

    // TODO: Only return posts that the user has access to
    [HttpGet]
    public async Task<ActionResult<IEnumerable<PostDto>>> GetAllPosts()
    {
        var posts = await _postService.GetAllPostsAsync(true);
        return Ok(posts);
    }
    
    [HttpGet("feed")]
    public async Task<ActionResult<IEnumerable<PostDto>>> GetFeed(int page=1, int pageSize=20)
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

    [HttpPost]
    public async Task<ActionResult<PostDto>> CreatePost(string text)
    {
        var idClaim = this.HttpContext.User.Claims.FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");
        if (idClaim == null)
        {
            return Unauthorized();
        }
        var createdPost = await _postService.CreatePostAsync(new Guid(idClaim.Value), text);
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