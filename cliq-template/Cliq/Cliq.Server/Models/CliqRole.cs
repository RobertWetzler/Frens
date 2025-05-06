using Microsoft.AspNetCore.Identity;

namespace Cliq.Server.Models;
public class CliqRole : IdentityRole<Guid>
{
    /// <summary>
    /// Initializes a new instance of <see cref="CliqRole"/>.
    /// </summary>
    /// <remarks>
    /// The Id property is initialized to a new GUID value.
    /// </remarks>
    public CliqRole()
    {
        Id = Guid.NewGuid();
    }

    /// <summary>
    /// Initializes a new instance of <see cref="CliqRole"/>.
    /// </summary>
    /// <param name="roleName">The role name.</param>
    /// <remarks>
    /// The Id property is initialized to a new GUID value.
    /// </remarks>
    public CliqRole(string roleName) : this()
    {
        Name = roleName;
    }
}