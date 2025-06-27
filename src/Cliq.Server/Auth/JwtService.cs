using Cliq.Server.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace Cliq.Server.Auth;
public class JwtService
{
    private readonly IConfiguration _configuration;

    public JwtService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public string GenerateJwtToken(User user)
    {
        var jwtSettings = _configuration.GetSection("JwtSettings");
        // TODO make this static helper method
        byte[] key;
        // Get key from env variable in production
        if (string.IsNullOrEmpty(jwtSettings["Secret"]))
        {
            var envKey = Environment.GetEnvironmentVariable("JWT_SECRET");
            if (string.IsNullOrEmpty(envKey))
            {
                throw new InvalidOperationException("JWT secret is not configured. Set JWT_SECRET environment variable or configure JwtSettings in appsettings.");
            }
            key = Encoding.ASCII.GetBytes(envKey);
        }
        else
        {
            key = Encoding.ASCII.GetBytes(jwtSettings["Secret"]);
        }
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddDays(7), // Token expiration time
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(key),
                SecurityAlgorithms.HmacSha256Signature
            ),
            Issuer = jwtSettings["Issuer"],
            Audience = jwtSettings["Audience"]
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var token = tokenHandler.CreateToken(tokenDescriptor);

        return tokenHandler.WriteToken(token);
    }
}
