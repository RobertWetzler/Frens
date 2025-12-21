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
    public async Task<ActionResult<CommentDto>> PostComment(string text, Guid postId, Guid? parentCommentid = null)
    {
        var idClaim = this.HttpContext.User.Claims.FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");
        if (idClaim == null)
        {
            return Unauthorized();
        }
        var comment = await _commentService.CreateCommentAsync(text, new Guid(idClaim.Value), postId, parentCommentid);
        if (comment == null)
        {
            return NotFound();
        }
        return Ok(comment);
    }

    // Create a carpool comment (special comment that allows users to claim seats)
    [HttpPost("carpool")]
    public async Task<ActionResult<CommentDto>> PostCarpoolComment(string text, Guid postId, int spots, Guid? parentCommentId = null)
    {
        var idClaim = this.HttpContext.User.Claims.FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");
        if (idClaim == null)
        {
            return Unauthorized();
        }
        var comment = await _commentService.CreateCarpoolCommentAsync(text, new Guid(idClaim.Value), postId, spots, parentCommentId);
        return Ok(comment);
    }

    // Toggle (join/leave) a seat in a carpool comment
    [HttpPost("{commentId:guid}/carpool/optin")]
    public async Task<ActionResult> ToggleCarpoolSeat(Guid commentId)
    {
        var idClaim = this.HttpContext.User.Claims.FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");
        if (idClaim == null)
        {
            return Unauthorized();
        }
        try
        {
            var joined = await _commentService.ToggleCarpoolSeatAsync(commentId, new Guid(idClaim.Value));
            return Ok(new { joined });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }
}
