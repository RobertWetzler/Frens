using System;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Identity;
using Cliq.Server.Models;

namespace Cliq.Server.Utilities;

/// <summary>
/// Helper utilities to process ad-hoc CLI maintenance commands without exposing HTTP surface area.
/// </summary>
public static class CliTools
{
    /// <summary>
    /// Attempt to process a CLI command. Returns true if a handler executed and the host should exit.
    /// </summary>
    public static async Task<bool> TryHandleCliAsync(string[] args, IServiceProvider rootServices)
    {
        if (args.Length == 0) return false;

        var verb = args[0].Trim().ToLowerInvariant();
        switch (verb)
        {
            case "reset-password":
                await HandleResetPasswordAsync(args, rootServices);
                return true;
            case "help":
            case "--help":
            case "-h":
                PrintHelp();
                return true;
            default:
                return false; // Not a CLI verb we care about; continue normal startup
        }
    }

    private static void PrintHelp()
    {
        Console.WriteLine("CLI Utility Commands:");
        Console.WriteLine("  reset-password <email> <NewPassword>   Reset a user's password (clears lockout state).");
        Console.WriteLine();
        Console.WriteLine("Examples:");
        Console.WriteLine("  dotnet run -- reset-password user@example.com 'TempPass123!!'");
    }

    private static async Task HandleResetPasswordAsync(string[] args, IServiceProvider rootServices)
    {
        if (args.Length < 3)
        {
            Console.WriteLine("Usage: dotnet run -- reset-password <email> <NewPassword>");
            return;
        }

        var email = args[1];
        var newPassword = args[2];

        using var scope = rootServices.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<User>>();
        var user = await userManager.FindByEmailAsync(email);
        if (user == null)
        {
            Console.WriteLine($"User not found: {email}");
            return;
        }

        // Clear lockout if present so user can immediately sign in with new password
        if (await userManager.IsLockedOutAsync(user))
        {
            await userManager.SetLockoutEndDateAsync(user, DateTimeOffset.UtcNow);
            await userManager.ResetAccessFailedCountAsync(user);
            Console.WriteLine("Lockout state cleared.");
        }

        var resetToken = await userManager.GeneratePasswordResetTokenAsync(user);
        var result = await userManager.ResetPasswordAsync(user, resetToken, newPassword);
        if (result.Succeeded)
        {
            Console.WriteLine($"Password reset succeeded for {email}.");
            Console.WriteLine("Advise the user to log in and change it promptly.");
        }
        else
        {
            Console.WriteLine("Password reset failed:");
            foreach (var err in result.Errors)
            {
                Console.WriteLine($" - {err.Code}: {err.Description}");
            }
            Console.WriteLine("No changes were applied if errors are present.");
        }
    }
}
