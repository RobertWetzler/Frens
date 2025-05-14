namespace Cliq.Utilities;

public static class AuthUtils
{
    public static bool TryGetUserIdFromToken(HttpContext httpContext, out Guid userId)
    {
        var idClaim = httpContext.User.Claims.FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");
        userId = Guid.Empty;
        return idClaim?.Value != null && Guid.TryParse(idClaim.Value, out userId);
    }
}