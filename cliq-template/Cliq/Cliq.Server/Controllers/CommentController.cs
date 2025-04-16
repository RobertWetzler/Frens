using Cliq.Server.Models;
using Cliq.Server.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Identity;

namespace Cliq.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CommentController : ControllerBase
{
    private readonly ICommentService _commentService;

    public CommentController(ICommentService commentService)
    {
        _commentService = commentService;
    }

    // TODO: validate user has permissions to view post
    [HttpPost]
    public async Task<ActionResult<CommentDto>> PostComment(string text, string postId, string? parentCommentid = null)
    {
        // TODO: Get UserId from JWT token
        //User.Identity.GetUserId()
        var userId = "seedUser1";
        var comment = await _commentService.CreateCommentAsync(text, userId, postId, parentCommentid);
        if (comment == null)
        {
            return NotFound();
        }
        return Ok(comment);
    }
}
