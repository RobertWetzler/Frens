using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using Cliq.Server.Models;
using Cliq.Server.Services;
using Cliq.Utilities;
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
    public async Task<ActionResult<CommentDto>> PostComment([FromBody] CreateCommentRequestDto body)
    {
        var id = this.HttpContext.User.Identity;
        var idClaim = this.HttpContext.User.Claims.FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");
        if (idClaim == null)
        {
            return Unauthorized();
        }

        var request = new CreateCommentRequest(
            Text: body.Text,
            UserId: new Guid(idClaim.Value),
            PostId: body.PostId,
            ParentCommentId: body.ParentCommentId,
            Mentions: body.Mentions
        );

        var comment = await _commentService.CreateCommentAsync(request);
        if (comment == null)
        {
            return NotFound();
        }
        return Ok(comment);
    }

    // Create a carpool comment (special comment that allows users to claim seats)
    [HttpPost("carpool")]
    public async Task<ActionResult<CommentDto>> PostCarpoolComment([FromBody] CreateCarpoolCommentRequestDto body)
    {
        var idClaim = this.HttpContext.User.Claims.FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");
        if (idClaim == null)
        {
            return Unauthorized();
        }

        var request = new CreateCarpoolCommentRequest(
            Text: body.Text,
            UserId: new Guid(idClaim.Value),
            PostId: body.PostId,
            Spots: body.Spots,
            ParentCommentId: body.ParentCommentId,
            Mentions: body.Mentions
        );

        var comment = await _commentService.CreateCommentAsync(request);
        return Ok(comment);
    }

    // Toggle (join/leave) a seat in a carpool comment
    [HttpPost("{commentId:guid}/carpool/optin")]
    public async Task<ActionResult> ToggleCarpoolSeat(Guid commentId)
    {
        if (!AuthUtils.TryGetUserIdFromToken(this.HttpContext, out var userId))
        {
            return Unauthorized();
        }
        AuthUtils.TryGetUserNameFromToken(this.HttpContext, out var username);
        try
        {
            var joined = await _commentService.ToggleCarpoolSeatAsync(commentId, userId, username);
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
