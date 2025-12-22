using System.Security.Claims;

namespace Cliq.Utilities;

public static class AuthUtils
{
    public static bool TryGetUserIdFromToken(HttpContext httpContext, out Guid userId)
    {
        var idClaim = httpContext.User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier);
        userId = Guid.Empty;
        return idClaim?.Value != null && Guid.TryParse(idClaim.Value, out userId);
    }

    public static bool TryGetUserNameFromToken(HttpContext httpContext, out string username)
    {
        var idClaim = httpContext.User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Name);
        username = idClaim?.Value ?? string.Empty;
        return idClaim?.Value != null;
    }
}