using Cliq.Server.Models;
using Cliq.Server.Services;
using Microsoft.AspNetCore.Mvc;

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
        var idClaim = this.HttpContext.User.Claims.FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");
        if (idClaim == null)
        {
            return Unauthorized();
        }
        var comment = await _commentService.CreateCommentAsync(text, idClaim.Value, postId, parentCommentid);
        if (comment == null)
        {
            return NotFound();
        }
        return Ok(comment);
    }
}
