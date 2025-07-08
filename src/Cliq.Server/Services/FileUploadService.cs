using Amazon.S3;
using Amazon.S3.Model;
using Cliq.Server.Models;
using Microsoft.Extensions.Options;

namespace Cliq.Server.Services;

public interface IFileUploadService
{
    Task<string> UploadProfileImageAsync(Guid userId, IFormFile file);
    Task DeleteFileAsync(string key);
    Task<string> GetSignedUrlAsync(string key, TimeSpan expiry);
    bool IsValidImageFile(IFormFile file);
}

public class S3FileUploadService : IFileUploadService
{
    private readonly IAmazonS3 _s3Client;
    private readonly S3Settings _s3Settings;
    private readonly ILogger<S3FileUploadService> _logger;

    public S3FileUploadService(
        IAmazonS3 s3Client,
        IOptions<S3Settings> s3Settings,
        ILogger<S3FileUploadService> logger)
    {
        _s3Client = s3Client;
        _s3Settings = s3Settings.Value;
        _logger = logger;
    }

    public async Task<string> UploadProfileImageAsync(Guid userId, IFormFile file)
    {
        if (!IsValidImageFile(file))
        {
            throw new ArgumentException("Invalid file type or size");
        }

        var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var key = $"profile-images/{userId}/{Guid.NewGuid()}{fileExtension}";

        try
        {
            using var stream = file.OpenReadStream();
            
            var request = new PutObjectRequest
            {
                BucketName = _s3Settings.BucketName,
                Key = key,
                InputStream = stream,
                ContentType = file.ContentType,
                CannedACL = S3CannedACL.Private, // Keep files private
                Metadata =
                {
                    ["user-id"] = userId.ToString(),
                    ["original-filename"] = file.FileName,
                    ["upload-date"] = DateTime.UtcNow.ToString("O")
                }
            };

            var response = await _s3Client.PutObjectAsync(request);
            
            if (response.HttpStatusCode == System.Net.HttpStatusCode.OK)
            {
                _logger.LogInformation("Successfully uploaded profile image for user {UserId} with key {Key}", userId, key);
                return key;
            }
            
            throw new Exception($"Failed to upload file: {response.HttpStatusCode}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading profile image for user {UserId}", userId);
            throw;
        }
    }

    public async Task DeleteFileAsync(string key)
    {
        try
        {
            var request = new DeleteObjectRequest
            {
                BucketName = _s3Settings.BucketName,
                Key = key
            };

            var response = await _s3Client.DeleteObjectAsync(request);
            _logger.LogInformation("Successfully deleted file with key {Key}", key);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting file with key {Key}", key);
            throw;
        }
    }

    public async Task<string> GetSignedUrlAsync(string key, TimeSpan expiry)
    {
        try
        {
            var request = new GetPreSignedUrlRequest
            {
                BucketName = _s3Settings.BucketName,
                Key = key,
                Verb = HttpVerb.GET,
                Expires = DateTime.UtcNow.Add(expiry)
            };

            return await _s3Client.GetPreSignedURLAsync(request);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating signed URL for key {Key}", key);
            throw;
        }
    }

    public bool IsValidImageFile(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return false;

        if (file.Length > _s3Settings.MaxFileSizeBytes)
            return false;

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!_s3Settings.AllowedExtensions.Contains(extension))
            return false;

        // Additional MIME type validation
        var allowedMimeTypes = new[]
        {
            "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"
        };

        return allowedMimeTypes.Contains(file.ContentType.ToLowerInvariant());
    }
}
