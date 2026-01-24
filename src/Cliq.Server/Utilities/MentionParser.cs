using Cliq.Server.Data;
using Cliq.Server.Models;
using Cliq.Server.Services;
using Microsoft.EntityFrameworkCore;

namespace Cliq.Server.Utilities;

/// <summary>
/// Utility class for validating and processing user mentions in post and comment text.
/// Mentions are provided by the client with user IDs and text positions, and validated server-side.
/// </summary>
public static class MentionParser
{
    /// <summary>
    /// Validates and filters mentions to only include valid ones.
    /// Checks that:
    /// 1. The mention position is valid within the text
    /// 2. The mention starts with @ in the text
    /// 3. The mentioned name in text matches the user's actual name
    /// 4. The mentioned user is a friend of the author (or otherwise allowed to be mentioned)
    /// </summary>
    /// <param name="text">The text containing mentions</param>
    /// <param name="mentions">The mentions provided by the client</param>
    /// <param name="authorId">The ID of the user who wrote the text</param>
    /// <param name="dbContext">Database context</param>
    /// <param name="friendshipService">Friendship service to verify friendships</param>
    /// <returns>List of validated mentions with user IDs</returns>
    public static async Task<List<MentionDto>> ValidateMentionsAsync(
        string text,
        List<MentionDto> mentions,
        Guid authorId,
        CliqDbContext dbContext,
        IFriendshipService friendshipService)
    {
        if (string.IsNullOrWhiteSpace(text) || mentions == null || !mentions.Any())
            return new List<MentionDto>();

        var validMentions = new List<MentionDto>();
        var processedUserIds = new HashSet<Guid>();

        // Get all mentioned users in one query
        var mentionedUserIds = mentions.Select(m => m.UserId).Distinct().ToList();
        var users = await dbContext.Users
            .Where(u => mentionedUserIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u);

        foreach (var mention in mentions)
        {
            // Skip duplicates
            if (processedUserIds.Contains(mention.UserId))
                continue;

            // Skip self-mentions
            if (mention.UserId == authorId)
                continue;

            // Validate position bounds
            if (mention.Start < 0 || mention.End > text.Length || mention.Start >= mention.End)
                continue;

            // Check that the position starts with @
            if (text[mention.Start] != '@')
                continue;

            // Get the text at the mention position
            var mentionText = text.Substring(mention.Start + 1, mention.End - mention.Start - 1); // Skip the @

            // Get the user from our lookup
            if (!users.TryGetValue(mention.UserId, out var user))
                continue;

            // Validate that the name in text matches the user's name (case-insensitive)
            if (!string.Equals(mentionText.Trim(), mention.Name.Trim(), StringComparison.OrdinalIgnoreCase))
                continue;

            // Also validate that the provided name matches the actual user's name
            if (!string.Equals(user.Name.Trim(), mention.Name.Trim(), StringComparison.OrdinalIgnoreCase))
                continue;

            // Check if they are friends
            var areFriends = await friendshipService.AreFriendsAsync(authorId, mention.UserId);
            if (!areFriends)
                continue;

            validMentions.Add(mention);
            processedUserIds.Add(mention.UserId);
        }

        return validMentions;
    }

    /// <summary>
    /// Gets user IDs from validated mentions (for notification purposes)
    /// </summary>
    public static List<Guid> GetMentionedUserIds(List<MentionDto> validMentions)
    {
        return validMentions.Select(m => m.UserId).Distinct().ToList();
    }

    /// <summary>
    /// Legacy method for backward compatibility - parses @mentions from text.
    /// New code should use ValidateMentionsAsync with client-provided mentions.
    /// </summary>
    [Obsolete("Use ValidateMentionsAsync with client-provided mentions instead")]
    public static async Task<List<Guid>> GetMentionedFriendIdsAsync(
        string text, 
        Guid authorId, 
        CliqDbContext dbContext,
        IFriendshipService friendshipService)
    {
        // This is a simplified fallback - new clients should provide mentions directly
        if (string.IsNullOrWhiteSpace(text))
            return new List<Guid>();

        // Simple regex to find @mentions (this is less reliable than client-provided mentions)
        var mentionPattern = new System.Text.RegularExpressions.Regex(@"@(\S+)");
        var matches = mentionPattern.Matches(text);
        
        if (!matches.Any())
            return new List<Guid>();

        var names = matches.Select(m => m.Groups[1].Value.ToLower()).Distinct().ToList();

        // Find users matching the mentioned names (case-insensitive)
        var mentionedUsers = await dbContext.Users
            .Where(u => names.Contains(u.Name.ToLower()))
            .Select(u => new { u.Id, u.Name })
            .ToListAsync();

        if (!mentionedUsers.Any())
            return new List<Guid>();

        // Filter to only include users who are friends with the author
        var friendIds = new List<Guid>();
        foreach (var user in mentionedUsers)
        {
            if (user.Id == authorId)
                continue;

            var areFriends = await friendshipService.AreFriendsAsync(authorId, user.Id);
            if (areFriends)
            {
                friendIds.Add(user.Id);
            }
        }

        return friendIds;
    }
}
