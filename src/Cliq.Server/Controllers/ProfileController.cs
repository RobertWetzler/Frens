using AutoMapper;
using Cliq.Server.Data;
using Cliq.Server.Models;
using Cliq.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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
        private readonly CliqDbContext _context;
        private readonly IObjectStorageService _storage;

        public ProfileController(
            UserManager<User> userManager,
            IFriendshipService friendshipService,
            IPostService postService,
            IMapper mapper,
            CliqDbContext context,
            IObjectStorageService storage)
        {
            _userManager = userManager;
            _friendshipService = friendshipService;
            _postService = postService;
            _mapper = mapper;
            _context = context;
            _storage = storage;
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
            
            // Set profile picture URL if user has one
            if (!string.IsNullOrEmpty(user.ProfilePictureKey))
            {
                userProfile.ProfilePictureUrl = _storage.GetProfilePictureUrl(user.ProfilePictureKey);
            }

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

            // Get easter egg count and list
            var easterEggs = await _context.EasterEggs
                .Where(e => e.UserId == userIdToUse)
                .Select(e => new EasterEggDto
                {
                    EasterEggId = e.EasterEggId,
                    DiscoveredAt = e.DiscoveredAt
                })
                .ToListAsync();

            response.EasterEggsFound = easterEggs;
            response.EasterEggCount = easterEggs.Count;

            return Ok(response);
        }

        [HttpPost("picture")]
        [RequestSizeLimit(10_000_000)] // ~10MB limit for profile pictures
        [Consumes("multipart/form-data")]
        [ProducesResponseType(typeof(ProfilePictureResponseDto), StatusCodes.Status200OK)]
        public async Task<ActionResult<ProfilePictureResponseDto>> UploadProfilePicture([FromForm] UploadProfilePictureRequest request)
        {
            var currentUserId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
            
            if (request.Image == null || request.Image.Length == 0)
            {
                return BadRequest("No image provided");
            }

            var allowed = new[] { "image/png", "image/jpeg", "image/heic", "image/webp" };
            if (!allowed.Contains(request.Image.ContentType))
            {
                return BadRequest($"Unsupported image content type: {request.Image.ContentType}");
            }

            if (request.Image.Length > 10_000_000)
            {
                return BadRequest("Image too large (>10MB)");
            }

            var imageProcessor = HttpContext.RequestServices.GetService<IImageProcessingService>();
            if (imageProcessor == null)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, "Image processing service not available");
            }

            // Process & compress the image (smaller size for profile pictures)
            await using var originalStream = request.Image.OpenReadStream();
            var (processedStream, outputContentType) = await imageProcessor.ProcessAsync(
                originalStream, 
                request.Image.ContentType, 
                maxWidth: 512, 
                maxHeight: 512, 
                preferredMaxBytes: 200_000 // Target ~200KB for profile pictures
            );

            // Upload to storage
            var key = await _storage.UploadProfilePictureAsync(currentUserId, processedStream, outputContentType);

            // Update user's profile picture key in database
            var user = await _userManager.FindByIdAsync(currentUserId.ToString());
            if (user == null)
            {
                return NotFound("User not found");
            }

            user.ProfilePictureKey = key;
            await _userManager.UpdateAsync(user);

            // Return the public URL
            var url = _storage.GetProfilePictureUrl(key);
            return Ok(new ProfilePictureResponseDto { ProfilePictureUrl = url });
        }

        public class ProfilePictureResponseDto
        {
            public string ProfilePictureUrl { get; set; } = string.Empty;
        }

        public class UploadProfilePictureRequest
        {
            public IFormFile? Image { get; set; }
        }


        public class ProfilePageResponseDto
        {
            public UserProfileDto Profile { get; set; } = null!;
            public bool IsCurrentUser { get; set; }
            public FriendshipStatusDto? FriendshipStatus { get; set; }
            public IEnumerable<PostDto> RecentPosts { get; set; } = new List<PostDto>();
            public int NotificationCount { get; set; } = 0;
            public int EasterEggCount { get; set; } = 0;
            public List<EasterEggDto> EasterEggsFound { get; set; } = new List<EasterEggDto>();
        }
    }
}