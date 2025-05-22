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
        private readonly IMapper _mapper;

        public ProfileController(
            UserManager<User> userManager,
            IFriendshipService friendshipService,
            IPostService postService,
            IMapper mapper)
        {
            _userManager = userManager;
            _friendshipService = friendshipService;
            _postService = postService;
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
            if (response.IsCurrentUser || response.FriendshipStatus?.Status == VisibleStatus.Friends)
            {
                response.RecentPosts = await _postService.GetUserPostsAsync(userIdToUse, page: 1, pageSize: 10);
            }

            return Ok(response);
        }



        public class ProfilePageResponseDto
        {
            public UserProfileDto Profile { get; set; } = null!;
            public bool IsCurrentUser { get; set; }
            public FriendshipStatusDto? FriendshipStatus { get; set; }
            public IEnumerable<PostDto> RecentPosts { get; set; } = new List<PostDto>();
        }
    }
}