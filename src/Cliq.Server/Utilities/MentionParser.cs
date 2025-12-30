using System.Text.RegularExpressions;
using Cliq.Server.Data;
using Cliq.Server.Services;
using Microsoft.EntityFrameworkCore;

namespace Cliq.Server.Utilities;

/// <summary>
/// Utility class for parsing @username mentions in post and comment text
/// </summary>
public static class MentionParser
{
    // Regex pattern to match @username (alphanumeric, underscore, period, hyphen)
    // Matches @username at word boundaries
    private static readonly Regex UsernamePattern = new Regex(
        @"@([a-zA-Z0-9._-]+)", 
        RegexOptions.Compiled
    );

    /// <summary>
    /// Extracts all @username mentions from the given text
    /// </summary>
    /// <param name="text">The text to parse for mentions</param>
    /// <returns>List of unique usernames (without the @ symbol)</returns>
    public static List<string> ExtractMentions(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return new List<string>();

        var matches = UsernamePattern.Matches(text);
        return matches
            .Select(m => m.Groups[1].Value.ToLower()) // Get username without @, normalize to lowercase
            .Distinct()
            .ToList();
    }

    /// <summary>
    /// Gets the user IDs of friends who were mentioned in the text
    /// </summary>
    /// <param name="text">The text containing potential mentions</param>
    /// <param name="authorId">The ID of the user who wrote the text</param>
    /// <param name="dbContext">Database context</param>
    /// <param name="friendshipService">Friendship service to verify friendships</param>
    /// <returns>List of user IDs who are friends with the author and were mentioned</returns>
    public static async Task<List<Guid>> GetMentionedFriendIdsAsync(
        string text, 
        Guid authorId, 
        CliqDbContext dbContext,
        IFriendshipService friendshipService)
    {
        var usernames = ExtractMentions(text);
        if (!usernames.Any())
            return new List<Guid>();

        // Find users matching the mentioned usernames (case-insensitive)
        var mentionedUsers = await dbContext.Users
            .Where(u => u.UserName != null && usernames.Contains(u.UserName.ToLower()))
            .Select(u => new { u.Id, u.UserName })
            .ToListAsync();

        if (!mentionedUsers.Any())
            return new List<Guid>();

        // Filter to only include users who are friends with the author
        var friendIds = new List<Guid>();
        foreach (var user in mentionedUsers)
        {
            // Skip if mentioning self
            if (user.Id == authorId)
                continue;

            // Check if they are friends
            var areFriends = await friendshipService.AreFriendsAsync(authorId, user.Id);
            if (areFriends)
            {
                friendIds.Add(user.Id);
            }
        }

        return friendIds;
    }
}
