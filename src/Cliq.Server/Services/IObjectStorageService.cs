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
    /// Generates a short-lived (expirySeconds) pre-signed URL for a private object key.
    /// Caller must already have authorized access to the underlying post.
    /// </summary>
    Task<string> GetTemporaryReadUrlAsync(string objectKey, int expirySeconds = 60);
}

public class BackblazeB2S3StorageService : IObjectStorageService
{
    private readonly IAmazonS3 _s3;
    private readonly ILogger<BackblazeB2S3StorageService> _logger;
    private readonly string _bucketName;
    private bool _bucketChecked = false;

    public BackblazeB2S3StorageService(IAmazonS3 s3, IConfiguration config, ILogger<BackblazeB2S3StorageService> logger)
    {
        _s3 = s3;
        _logger = logger;
        _bucketName = config["Backblaze:Bucket"] ?? throw new InvalidOperationException("Backblaze:Bucket not configured");
    }

    public async Task<string> UploadPostImageAsync(Guid userId, Stream content, string contentType, CancellationToken ct = default)
    {
        // Key format keeps objects partitioned per user and avoids guessing by using Guid part
        var key = $"users/{userId}/posts/{Guid.NewGuid():N}";
        try
        {
            if (!_bucketChecked)
            {
                _bucketChecked = true;
                try
                {
                    var exists = await Amazon.S3.Util.AmazonS3Util.DoesS3BucketExistV2Async(_s3, _bucketName);
                    if (!exists)
                    {
                        _logger.LogInformation("Bucket {Bucket} not found; creating (local dev?)", _bucketName);
                        await _s3.PutBucketAsync(_bucketName, ct);
                    }
                }
                catch (Exception bex)
                {
                    _logger.LogWarning(bex, "Bucket existence check failed for {Bucket}", _bucketName);
                }
            }
            var put = new PutObjectRequest
            {
                BucketName = _bucketName,
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
            _logger.LogError(ex, "Failed to upload post image for user {UserId}. Bucket {Bucket} Key {Key}", userId, _bucketName, key);
            throw;
        }
    }

    public Task<string> GetTemporaryReadUrlAsync(string objectKey, int expirySeconds = 60)
    {
        // AWSSDK S3 GetPreSignedURL handles time-bound signed URL generation
        var request = new GetPreSignedUrlRequest
        {
            BucketName = _bucketName,
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
}