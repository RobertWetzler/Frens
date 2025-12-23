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

        public ProfileController(
            UserManager<User> userManager,
            IFriendshipService friendshipService,
            IPostService postService,
            IMapper mapper,
            CliqDbContext context)
        {
            _userManager = userManager;
            _friendshipService = friendshipService;
            _postService = postService;
            _mapper = mapper;
            _context = context;
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

            // Get easter egg count and list
            var easterEggs = await _context.EasterEggs
                .Where(e => e.UserId == userIdToUse)
                .Select(e => new EasterEggDto
                {
                    EasterEggId = e.EasterEggId,
                    DiscoveredAt = e.DiscoveredAt
                })
                .ToListAsync();

            // Debug logging
            var allEggs = await _context.EasterEggs.ToListAsync();
            Console.WriteLine($"🥚 GetProfile - Looking for UserId: {userIdToUse}");
            Console.WriteLine($"🥚 Total eggs in DB: {allEggs.Count}");
            Console.WriteLine($"🥚 Eggs for this user: {easterEggs.Count}");
            foreach (var egg in allEggs)
            {
                Console.WriteLine($"  - Egg UserId: {egg.UserId}, EasterEggId: {egg.EasterEggId}");
            }

            response.EasterEggsFound = easterEggs;
            response.EasterEggCount = easterEggs.Count;

            return Ok(response);
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