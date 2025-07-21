using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Cliq.Server.Models;
using Cliq.Server.Auth;

namespace Cliq.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[AllowAnonymous] // Allow anonymous access to this controller
public class TestAuthController : ControllerBase
{
    private readonly UserManager<User> _userManager;
    private readonly JwtService _jwtService;
    private readonly IWebHostEnvironment _environment;

    public TestAuthController(UserManager<User> userManager, JwtService jwtService, IWebHostEnvironment environment)
    {
        _userManager = userManager;
        _jwtService = jwtService;
        _environment = environment;
    }

    /// <summary>
    /// Generate a test JWT token for development purposes
    /// </summary>
    /// <param name="email">Email of the test user (defaults to robert@gmail.com)</param>
    /// <returns>JWT token for the specified test user</returns>
    [HttpGet("generate-test-token")]
    public async Task<IActionResult> GenerateTestToken(string email = "robert@gmail.com")
    {
        // Only allow this in development
        if (!_environment.IsDevelopment())
        {
            return NotFound();
        }

        var user = await _userManager.FindByEmailAsync(email);
        if (user == null)
        {
            return BadRequest($"Test user with email {email} not found");
        }

        var token = _jwtService.GenerateJwtToken(user);
        
        return Ok(new { 
            token = token,
            user = new { 
                id = user.Id,
                email = user.Email,
                name = user.Name 
            },
            instructions = "Copy this token and paste it into the Swagger UI Authorization field (click 'Authorize' button and paste the token)"
        });
    }

    /// <summary>
    /// Get list of available test users
    /// </summary>
    /// <returns>List of test users available for token generation</returns>
    [HttpGet("test-users")]
    public async Task<IActionResult> GetTestUsers()
    {
        // Only allow this in development
        if (!_environment.IsDevelopment())
        {
            return BadRequest("Test users list is only available in development environment");
        }

        var testEmails = new[]
        {
            "robert@gmail.com",
            "smushi@example.com",
            "sandman@example.com",
            "devio@example.com",
            "twilly@example.com",
            "daddio@example.com"
        };

        var users = new List<object>();
        foreach (var email in testEmails)
        {
            var user = await _userManager.FindByEmailAsync(email);
            if (user != null)
            {
                users.Add(new { 
                    email = user.Email,
                    name = user.Name,
                    id = user.Id 
                });
            }
        }

        return Ok(new { 
            users = users,
            instructions = "Use the email of any user with /api/testauth/generate-test-token?email={email} to get a token"
        });
    }
}
