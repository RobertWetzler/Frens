using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

using Cliq.Server.Auth;
using Cliq.Server.Models;

namespace Cliq.Server.Controllers;

[Route("api/[controller]")]
[ApiController]
public class AccountController : ControllerBase
{
    private readonly UserManager<User> _userManager;
    private readonly SignInManager<User> _signInManager;
    private readonly JwtService _jwtService;

    public AccountController(
        UserManager<User> userManager,
        SignInManager<User> signInManager,
        JwtService jwtService)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _jwtService = jwtService;
    }

    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<SignInResponseDto>> Register([FromBody] RegisterModel model)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var user = new User() 
        { 
            UserName = model.Email,
            Name = model.Name,
            Email = model.Email,
        };

        var result = await _userManager.CreateAsync(user, model.Password);
        if (result.Succeeded)
        {
            // Generate JWT token
            var token = _jwtService.GenerateJwtToken(user);

            return Ok(new
            {
                user = new UserDto
                {
                    Id = user.Id,
                    Name = user.Name
                },
                token = token
            });
        }

        foreach (var error in result.Errors)
        {
            ModelState.AddModelError(string.Empty, error.Description);
        }

        return BadRequest(ModelState);
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<SignInResponseDto>> Login([FromBody] LoginModel model)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var result = await _signInManager.PasswordSignInAsync(model.Email, model.Password, model.RememberMe, lockoutOnFailure: true);

        if (result.Succeeded)
        {
            var user = await _userManager.FindByEmailAsync(model.Email);
            if (user == null)
            {
                return NotFound(new { error = "User not found" });
            }
            
            user.LastLogin = DateTime.UtcNow;
            await _userManager.UpdateAsync(user);  // Save the LastLogin change to the database

            // Generate JWT token
            var token = _jwtService.GenerateJwtToken(user);

            return Ok(new
            {
                user = new UserDto
                {
                    Id = user.Id,
                    Name = user.Name
                },
                token = token
            });
        }

        if (result.IsLockedOut)
        {
            return BadRequest(new { error = "User account locked out" });
        }

        return BadRequest(new { error = "Invalid login attempt" });
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await _signInManager.SignOutAsync();
        return Ok();
    }
}

public class RegisterModel
{
    public string Email { get; set; }
    public string Name { get; set; }
    public string Password { get; set; }
}

public class SignInResponseDto
{
    public required UserDto User { get; set; }
    public required string token { get; set; }
}

public class LoginModel
{
    public string Email { get; set; }
    public string Password { get; set; }
    public bool RememberMe { get; set; } = false;
}
