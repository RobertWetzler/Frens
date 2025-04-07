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

    [HttpGet("{id}")]
    public async Task<ActionResult<PostDto>> GetPost(string id, bool includeCommentTree = true)
    {
        var post = await _postService.GetPostByIdAsync(id, includeCommentTree);
        if (post == null)
        {
            return NotFound();
        }
        return Ok(post);
    }

    
    [HttpGet]
    public async Task<ActionResult<IEnumerable<PostDto>>> GetAllPosts()
    {
        var posts = await _postService.GetAllPostsAsync(true);
        return Ok(posts);
    }
    

    [HttpPost]
    public async Task<ActionResult<PostDto>> CreatePost(string userId, string text)
    {
        var createdPost = await _postService.CreatePostAsync(userId, text);
        return CreatedAtAction(nameof(GetPost), new { id = createdPost.Id }, createdPost);
    }

    // TODO: Authorize userId matches that of postId
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdatePost(string id, string newText)
    {
        var updatedPost = await _postService.UpdatePostAsync(id, newText);
        if (updatedPost == null)
        {
            return NotFound();
        }

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeletePost(string id)
    {
        var result = await _postService.DeletePostAsync(id);
        if (!result)
        {
            return NotFound();
        }

        return NoContent();
    }
}