using AutoMapper;
using Cliq.Server.Data;
using Cliq.Server.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Cliq.Server.Services;

public interface IUserService
{
    Task<UserProfileDto> UpdateProfileImageAsync(Guid userId, IFormFile imageFile);
    Task<UserProfileDto> RemoveProfileImageAsync(Guid userId);
    Task<string?> GetProfileImageUrlAsync(Guid userId);
}

public class UserService : IUserService
{
    private readonly UserManager<User> _userManager;
    private readonly IFileUploadService _fileUploadService;
    private readonly IMapper _mapper;
    private readonly ILogger<UserService> _logger;

    public UserService(
        UserManager<User> userManager,
        IFileUploadService fileUploadService,
        IMapper mapper,
        ILogger<UserService> logger)
    {
        _userManager = userManager;
        _fileUploadService = fileUploadService;
        _mapper = mapper;
        _logger = logger;
    }

    public async Task<UserProfileDto> UpdateProfileImageAsync(Guid userId, IFormFile imageFile)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user == null)
        {
            throw new ArgumentException("User not found");
        }

        try
        {
            // Delete old image if exists
            if (!string.IsNullOrEmpty(user.ProfileImageKey))
            {
                await _fileUploadService.DeleteFileAsync(user.ProfileImageKey);
            }

            // Upload new image
            var newImageKey = await _fileUploadService.UploadProfileImageAsync(userId, imageFile);
            
            // Generate signed URL (valid for 24 hours)
            var imageUrl = await _fileUploadService.GetSignedUrlAsync(newImageKey, TimeSpan.FromHours(24));

            // Update user record
            user.ProfileImageKey = newImageKey;
            user.ProfileImageUrl = imageUrl;

            var result = await _userManager.UpdateAsync(user);
            if (!result.Succeeded)
            {
                // If user update fails, clean up the uploaded file
                await _fileUploadService.DeleteFileAsync(newImageKey);
                throw new Exception($"Failed to update user: {string.Join(", ", result.Errors.Select(e => e.Description))}");
            }

            _logger.LogInformation("Successfully updated profile image for user {UserId}", userId);
            return _mapper.Map<UserProfileDto>(user);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating profile image for user {UserId}", userId);
            throw;
        }
    }

    public async Task<UserProfileDto> RemoveProfileImageAsync(Guid userId)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user == null)
        {
            throw new ArgumentException("User not found");
        }

        try
        {
            // Delete image from S3 if exists
            if (!string.IsNullOrEmpty(user.ProfileImageKey))
            {
                await _fileUploadService.DeleteFileAsync(user.ProfileImageKey);
            }

            // Clear image fields
            user.ProfileImageKey = null;
            user.ProfileImageUrl = null;

            var result = await _userManager.UpdateAsync(user);
            if (!result.Succeeded)
            {
                throw new Exception($"Failed to update user: {string.Join(", ", result.Errors.Select(e => e.Description))}");
            }

            _logger.LogInformation("Successfully removed profile image for user {UserId}", userId);
            return _mapper.Map<UserProfileDto>(user);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing profile image for user {UserId}", userId);
            throw;
        }
    }

    public async Task<string?> GetProfileImageUrlAsync(Guid userId)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user == null || string.IsNullOrEmpty(user.ProfileImageKey))
        {
            return null;
        }

        try
        {
            // Generate a fresh signed URL (valid for 24 hours)
            return await _fileUploadService.GetSignedUrlAsync(user.ProfileImageKey, TimeSpan.FromHours(24));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating profile image URL for user {UserId}", userId);
            return null;
        }
    }
}
