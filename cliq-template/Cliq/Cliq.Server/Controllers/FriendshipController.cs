using AutoMapper;
using Cliq.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;

namespace Cliq.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class FriendshipController : ControllerBase
    {
        private readonly IFriendshipService _friendshipService;
        private readonly IMapper _mapper;

        public FriendshipController(IFriendshipService friendshipService, IMapper mapper)
        {
            _friendshipService = friendshipService;
            _mapper = mapper;
        }

        /// <summary>
        /// Gets the current user ID from claims
        /// </summary>
        private string GetCurrentUserId()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                throw new UnauthorizedAccessException("User is not authenticated or ID is missing");
            }
            return userId;
        }

        [HttpPost("send-request/{addresseeId}")]
        public async Task<ActionResult<FriendshipDto>> SendFriendRequest(string addresseeId)
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                var result = await _friendshipService.SendFriendRequestAsync(currentUserId, addresseeId);
                return Ok(result);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        [HttpPost("accept-request/{friendshipId}")]
        public async Task<ActionResult<FriendshipDto>> AcceptFriendRequest(string friendshipId)
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                var result = await _friendshipService.AcceptFriendRequestAsync(friendshipId, currentUserId);
                return Ok(result);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        [HttpPost("reject-request/{friendshipId}")]
        public async Task<ActionResult> RejectFriendRequest(string friendshipId)
        {
            var currentUserId = GetCurrentUserId();
            var result = await _friendshipService.RejectFriendRequestAsync(friendshipId, currentUserId);

            if (result)
            {
                return Ok(new { success = true });
            }
            
            return NotFound(new { error = "Friend request not found or you don't have permission to reject it" });
        }

        [HttpDelete("cancel-request/{friendshipId}")]
        public async Task<ActionResult> CancelFriendRequest(string friendshipId)
        {
            var currentUserId = GetCurrentUserId();
            var result = await _friendshipService.CancelFriendRequestAsync(friendshipId, currentUserId);

            if (result)
            {
                return Ok(new { success = true });
            }
            
            return NotFound(new { error = "Friend request not found or you don't have permission to cancel it" });
        }

        [HttpDelete("remove-friend/{friendId}")]
        public async Task<ActionResult> RemoveFriend(string friendId)
        {
            var currentUserId = GetCurrentUserId();
            var result = await _friendshipService.RemoveFriendshipAsync(currentUserId, friendId);

            if (result)
            {
                return Ok(new { success = true });
            }
            
            return NotFound(new { error = "Friendship not found or users are not currently friends" });
        }

        [HttpPost("block-user/{userToBlockId}")]
        public async Task<ActionResult> BlockUser(string userToBlockId)
        {
            var currentUserId = GetCurrentUserId();
            var result = await _friendshipService.BlockUserAsync(currentUserId, userToBlockId);

            return Ok(new { success = result });
        }

        [HttpGet("friend-requests")]
        public async Task<ActionResult<IEnumerable<FriendshipDto>>> GetFriendRequests()
        {
            var currentUserId = GetCurrentUserId();
            var friendRequests = await _friendshipService.GetFriendRequestsAsync(currentUserId);
            
            return Ok(friendRequests);
        }

        [HttpGet("friends")]
        public async Task<ActionResult<IEnumerable<UserDto>>> GetFriends()
        {
            var currentUserId = GetCurrentUserId();
            var friends = await _friendshipService.GetFriendsAsync(currentUserId);
            
            return Ok(friends);
        }

        [HttpGet("status/{userId}")]
        public async Task<ActionResult<FriendshipStatusDto>> GetFriendshipStatus(string userId)
        {
            var currentUserId = GetCurrentUserId();
            var status = await _friendshipService.GetFriendshipStatusAsync(currentUserId, userId);
            
            return Ok(status);
        }

        [HttpGet("check/{userId}")]
        public async Task<ActionResult<bool>> CheckIfFriends(string userId)
        {
            var currentUserId = GetCurrentUserId();
            var areFriends = await _friendshipService.AreFriendsAsync(currentUserId, userId);
            
            return Ok(areFriends);
        }
    }
}