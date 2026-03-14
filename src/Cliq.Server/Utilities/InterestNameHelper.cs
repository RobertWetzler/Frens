using System.Text.RegularExpressions;

namespace Cliq.Server.Utilities;

/// <summary>
/// Utility for normalizing and validating interest names.
/// Interests use normalized names for uniqueness (lowercase, no spaces)
/// but preserve display names for UI.
/// </summary>
public static partial class InterestNameHelper
{
    /// <summary>
    /// Minimum length for an interest name.
    /// </summary>
    public const int MinLength = 2;

    /// <summary>
    /// Maximum length for an interest name.
    /// </summary>
    public const int MaxLength = 50;

    /// <summary>
    /// Normalizes an interest name for storage and comparison.
    /// - Converts to lowercase
    /// - Removes leading/trailing whitespace
    /// - Replaces spaces with underscores
    /// - Removes special characters except underscores
    /// - Collapses multiple underscores into one
    /// 
    /// Examples:
    /// "Hello Kitty" -> "hello_kitty"
    /// "Seattle Climbing" -> "seattle_climbing"
    /// "C++" -> "c"
    /// "#recipes" -> "recipes"
    /// </summary>
    public static string Normalize(string input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return string.Empty;

        // Trim and lowercase
        var normalized = input.Trim().ToLowerInvariant();

        // Remove leading # if present (common hashtag format)
        if (normalized.StartsWith('#'))
            normalized = normalized[1..];

        // Replace spaces with underscores
        normalized = normalized.Replace(' ', '_');

        // Remove all characters except letters, numbers, and underscores
        normalized = AlphanumericUnderscoreRegex().Replace(normalized, "");

        // Collapse multiple underscores into one
        normalized = MultipleUnderscoreRegex().Replace(normalized, "_");

        // Remove leading/trailing underscores
        normalized = normalized.Trim('_');

        return normalized;
    }

    /// <summary>
    /// Creates a display name from user input.
    /// Trims whitespace and removes leading # if present.
    /// </summary>
    public static string CreateDisplayName(string input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return string.Empty;

        var display = input.Trim();

        // Remove leading # if present
        if (display.StartsWith('#'))
            display = display[1..];

        return display.Trim();
    }

    /// <summary>
    /// Validates an interest name (after normalization).
    /// Returns null if valid, or an error message if invalid.
    /// </summary>
    public static string? Validate(string normalizedName)
    {
        if (string.IsNullOrWhiteSpace(normalizedName))
            return "Interest name cannot be empty.";

        if (normalizedName.Length < MinLength)
            return $"Interest name must be at least {MinLength} characters.";

        if (normalizedName.Length > MaxLength)
            return $"Interest name cannot exceed {MaxLength} characters.";

        // Should only contain lowercase letters, numbers, and underscores
        if (!ValidNameRegex().IsMatch(normalizedName))
            return "Interest name can only contain letters, numbers, and underscores.";

        return null; // Valid
    }

    /// <summary>
    /// Normalizes and validates an interest name in one step.
    /// Returns (normalizedName, displayName, errorMessage).
    /// If errorMessage is not null, the name is invalid.
    /// </summary>
    public static (string NormalizedName, string DisplayName, string? Error) NormalizeAndValidate(string input)
    {
        var displayName = CreateDisplayName(input);
        var normalizedName = Normalize(input);
        var error = Validate(normalizedName);

        return (normalizedName, displayName, error);
    }

    [GeneratedRegex("[^a-z0-9_]")]
    private static partial Regex AlphanumericUnderscoreRegex();

    [GeneratedRegex("_+")]
    private static partial Regex MultipleUnderscoreRegex();

    [GeneratedRegex("^[a-z0-9_]+$")]
    private static partial Regex ValidNameRegex();
}
