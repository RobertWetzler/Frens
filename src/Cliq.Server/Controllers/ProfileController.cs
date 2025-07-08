using AutoMapper;
using Cliq.Server.Models;
using Cliq.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Cliq.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ProfileController : ControllerBase
    {
        private readonly UserManager<User> _userManager;
        private readonly IFriendshipService _friendshipService;
        private readonly IPostService _postService;
        private readonly IUserService _userService;
        private readonly IMapper _mapper;

        public ProfileController(
            UserManager<User> userManager,
            IFriendshipService friendshipService,
            IPostService postService,
            IUserService userService,
            IMapper mapper)
        {
            _userManager = userManager;
            _friendshipService = friendshipService;
            _postService = postService;
            _userService = userService;
            _mapper = mapper;
        }

        [HttpGet]
        public async Task<ActionResult<ProfilePageResponseDto>> GetProfile(Guid? userId)
        {
            // Get current user ID from claims
            var currentUserId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
            Guid userIdToUse = userId ?? currentUserId;

            // Find target user
            var user = await _userManager.FindByIdAsync(userIdToUse.ToString());
            if (user == null)
            {
                return NotFound(new { error = "User not found" });
            }

            // Map user to profile DTO
            var userProfile = _mapper.Map<UserProfileDto>(user);

            // Initialize response
            var response = new ProfilePageResponseDto
            {
                Profile = userProfile,
                IsCurrentUser = userId == currentUserId
            };

            // Get friendship status if viewing someone else's profile
            if (!response.IsCurrentUser)
            {
                var friendshipStatus = await _friendshipService.GetFriendshipStatusAsync(currentUserId, userIdToUse);
                response.FriendshipStatus = friendshipStatus;
            }

            // Get recent posts by this user, only if the calling user has permission
            // to view them (i.e., they are friends or the user is viewing their own profile)
            if (response.IsCurrentUser)
            {
                response.RecentPosts = await _postService.GetUserPostsAsync(currentUserId, page: 1, pageSize: 10);
                response.NotificationCount = await _friendshipService.GetFriendRequestsCountAsync(currentUserId);
            }
            else if (response.FriendshipStatus?.Status == VisibleStatus.Friends)
            {
                // TODO: only get posts user has access to view
            }

            return Ok(response);
        }

        [HttpPost("upload-image")]
        public async Task<ActionResult<UserProfileDto>> UploadProfileImage(IFormFile image)
        {
            var currentUserId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            
            if (image == null || image.Length == 0)
            {
                return BadRequest(new { error = "No image file provided" });
            }

            try
            {
                var updatedProfile = await _userService.UpdateProfileImageAsync(currentUserId, image);
                return Ok(updatedProfile);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Failed to upload image" });
            }
        }

        [HttpDelete("remove-image")]
        public async Task<ActionResult<UserProfileDto>> RemoveProfileImage()
        {
            var currentUserId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            try
            {
                var updatedProfile = await _userService.RemoveProfileImageAsync(currentUserId);
                return Ok(updatedProfile);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Failed to remove image" });
            }
        }

        [HttpGet("image-url/{userId}")]
        public async Task<ActionResult<string>> GetProfileImageUrl(Guid userId)
        {
            try
            {
                var imageUrl = await _userService.GetProfileImageUrlAsync(userId);
                if (imageUrl == null)
                {
                    return NotFound(new { error = "No profile image found" });
                }
                return Ok(new { imageUrl });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Failed to get image URL" });
            }
        }



        public class ProfilePageResponseDto
        {
            public UserProfileDto Profile { get; set; } = null!;
            public bool IsCurrentUser { get; set; }
            public FriendshipStatusDto? FriendshipStatus { get; set; }
            public IEnumerable<PostDto> RecentPosts { get; set; } = new List<PostDto>();
            public int NotificationCount { get; set; } = 0;
        }
    }
}