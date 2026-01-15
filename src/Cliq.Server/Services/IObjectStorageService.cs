using Amazon.S3;
using Amazon.S3.Model;

namespace Cliq.Server.Services;

public interface IObjectStorageService
{
    /// <summary>
    /// Uploads an object stream to private storage returning the storage key.
    /// Caller is responsible for enforcing authorization semantics on retrieval.
    /// </summary>
    Task<string> UploadPostImageAsync(Guid userId, Stream content, string contentType, CancellationToken ct = default);
    
    /// <summary>
    /// Uploads a profile picture to public storage returning the public URL.
    /// Profile pictures are stored publicly for easy access across the app.
    /// </summary>
    Task<string> UploadProfilePictureAsync(Guid userId, Stream content, string contentType, CancellationToken ct = default);
    
    /// <summary>
    /// Gets the public URL for a profile picture key.
    /// </summary>
    string GetProfilePictureUrl(string objectKey);
    
    /// <summary>
    /// Generates a short-lived (expirySeconds) pre-signed URL for a private object key.
    /// Caller must already have authorized access to the underlying post.
    /// </summary>
    Task<string> GetTemporaryReadUrlAsync(string objectKey, int expirySeconds = 60);
}

public class BackblazeB2S3StorageService : IObjectStorageService
{
    private readonly IAmazonS3 _s3;
    private readonly ILogger<BackblazeB2S3StorageService> _logger;
    private readonly string _privateBucket;
    private readonly string _publicBucket;
    private readonly string _serviceUrl;
    private readonly string _publicBucketUrl;
    private bool _privateBucketChecked = false;
    private bool _publicBucketChecked = false;

    public BackblazeB2S3StorageService(IAmazonS3 s3, IConfiguration config, ILogger<BackblazeB2S3StorageService> logger)
    {
        _s3 = s3;
        _logger = logger;
        _privateBucket = config["Backblaze:Bucket"] ?? throw new InvalidOperationException("Backblaze:Bucket not configured");
        // Public bucket for profile pictures - defaults to same as private if not configured
        _publicBucket = config["Backblaze:PublicBucket"] ?? _privateBucket;
        _serviceUrl = (config["Backblaze:ServiceUrl"] ?? Environment.GetEnvironmentVariable("BACKBLAZE_SERVICE_URL") ?? "").TrimEnd('/');
        // Public bucket URL - for Backblaze, use friendly URL format; for local dev, use service URL
        _publicBucketUrl = config["Backblaze:PublicBucketUrl"] ?? _serviceUrl;
    }

    private async Task EnsurePrivateBucketExistsAsync(CancellationToken ct = default)
    {
        if (_privateBucketChecked) return;
        _privateBucketChecked = true;
        try
        {
            var exists = await Amazon.S3.Util.AmazonS3Util.DoesS3BucketExistV2Async(_s3, _privateBucket);
            if (!exists)
            {
                _logger.LogInformation("Private bucket {Bucket} not found; creating (local dev?)", _privateBucket);
                await _s3.PutBucketAsync(_privateBucket, ct);
            }
        }
        catch (Exception bex)
        {
            _logger.LogWarning(bex, "Bucket existence check failed for {Bucket}", _privateBucket);
        }
    }

    private async Task EnsurePublicBucketExistsAsync(CancellationToken ct = default)
    {
        if (_publicBucketChecked) return;
        _publicBucketChecked = true;
        
        // Skip if using same bucket for both
        if (_publicBucket == _privateBucket)
        {
            await EnsurePrivateBucketExistsAsync(ct);
            return;
        }
        
        try
        {
            var exists = await Amazon.S3.Util.AmazonS3Util.DoesS3BucketExistV2Async(_s3, _publicBucket);
            if (!exists)
            {
                _logger.LogInformation("Public bucket {Bucket} not found; creating (local dev?)", _publicBucket);
                await _s3.PutBucketAsync(_publicBucket, ct);
            }
        }
        catch (Exception bex)
        {
            _logger.LogWarning(bex, "Bucket existence check failed for {Bucket}", _publicBucket);
        }
    }

    public async Task<string> UploadPostImageAsync(Guid userId, Stream content, string contentType, CancellationToken ct = default)
    {
        // Key format keeps objects partitioned per user and avoids guessing by using Guid part
        var key = $"users/{userId}/posts/{Guid.NewGuid():N}";
        try
        {
            await EnsurePrivateBucketExistsAsync(ct);
            var put = new PutObjectRequest
            {
                BucketName = _privateBucket,
                Key = key,
                InputStream = content,
                ContentType = contentType,
                CannedACL = S3CannedACL.Private, // enforce privacy
            };
            // Additional security hardening: disable caching & store minimal metadata
            put.Headers.CacheControl = "private, max-age=0, no-cache";
            await _s3.PutObjectAsync(put, ct);
            return key;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to upload post image for user {UserId}. Bucket {Bucket} Key {Key}", userId, _privateBucket, key);
            throw;
        }
    }

    public Task<string> GetTemporaryReadUrlAsync(string objectKey, int expirySeconds = 60)
    {
        // AWSSDK S3 GetPreSignedURL handles time-bound signed URL generation
        var request = new GetPreSignedUrlRequest
        {
            BucketName = _privateBucket,
            Key = objectKey,
            Expires = DateTime.UtcNow.AddSeconds(expirySeconds),
            Verb = HttpVerb.GET
        };
        var url = _s3.GetPreSignedURL(request);
        // If development, replace https in url with http
        var env = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
        if (string.Equals(env, "Development", StringComparison.OrdinalIgnoreCase) &&
            url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            url = "http://" + url.Substring("https://".Length);
        }
        return Task.FromResult(url);
    }

    public async Task<string> UploadProfilePictureAsync(Guid userId, Stream content, string contentType, CancellationToken ct = default)
    {
        // Profile pictures use a fixed key per user (overwrites old picture)
        var key = $"users/{userId}/profile-picture";
        try
        {
            await EnsurePublicBucketExistsAsync(ct);
            
            var put = new PutObjectRequest
            {
                BucketName = _publicBucket,
                Key = key,
                InputStream = content,
                ContentType = contentType,
                CannedACL = S3CannedACL.PublicRead, // Profile pictures are public
            };
            // Allow caching for profile pictures
            put.Headers.CacheControl = "public, max-age=3600";
            await _s3.PutObjectAsync(put, ct);
            return key;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to upload profile picture for user {UserId}. Bucket {Bucket} Key {Key}", userId, _publicBucket, key);
            throw;
        }
    }

    public string GetProfilePictureUrl(string objectKey)
    {
        if (string.IsNullOrEmpty(objectKey))
            return string.Empty;
        
        // Build public URL using the configured public bucket URL
        // For Backblaze: https://f004.backblazeb2.com/file/{bucket}/{key}
        // For local dev: {serviceUrl}/{bucket}/{key}
        return $"{_publicBucketUrl}/{_publicBucket}/{objectKey}";
    }
}