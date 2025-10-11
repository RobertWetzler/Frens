using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.Processing;

namespace Cliq.Server.Services;

public interface IImageProcessingService
{
    /// <summary>
    /// Load an image from the provided source stream, optionally resize (preserving aspect ratio) so neither dimension exceeds maxPixels,
    /// and re-encode/compress so the resulting stream is under the preferredMaxBytes if possible (soft limit) while balancing quality.
    /// </summary>
    /// <param name="source">Original image stream (will not be modified).</param>
    /// <param name="contentType">Original content type.</param>
    /// <param name="maxWidth">Maximum width in pixels (maintains aspect ratio).</param>
    /// <param name="maxHeight">Maximum height in pixels (maintains aspect ratio).</param>
    /// <param name="preferredMaxBytes">Target upper size for output in bytes (soft cap).</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>(ProcessedStream, OutputContentType)</returns>
    Task<(Stream Stream, string OutputContentType)> ProcessAsync(Stream source, string contentType, int maxWidth, int maxHeight, long preferredMaxBytes, CancellationToken ct = default);
}

public class ImageProcessingService : IImageProcessingService
{
    private static readonly HashSet<string> SupportedInput = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg","image/png","image/webp","image/heic" // HEIC will be attempted via ImageSharp if codec available
    };

    public async Task<(Stream Stream, string OutputContentType)> ProcessAsync(Stream source, string contentType, int maxWidth, int maxHeight, long preferredMaxBytes, CancellationToken ct = default)
    {
        if (!SupportedInput.Contains(contentType))
        {
            // Just copy through (caller already validated allowed set)
            var passthrough = new MemoryStream();
            await source.CopyToAsync(passthrough, ct);
            passthrough.Position = 0;
            return (passthrough, contentType);
        }

        source.Position = 0; // ensure start
        Image image;
        try
        {
            image = await Image.LoadAsync(source, ct);
        }
        catch (SixLabors.ImageSharp.UnknownImageFormatException)
        {
            // Fallback: return original bytes unchanged
            var orig = new MemoryStream();
            source.Position = 0;
            await source.CopyToAsync(orig, ct);
            orig.Position = 0;
            return (orig, contentType);
        }
        using (image)
        {

            // Resize if needed
            if (image.Width > maxWidth || image.Height > maxHeight)
            {
                double ratio = Math.Min((double)maxWidth / image.Width, (double)maxHeight / image.Height);
                int newW = (int)Math.Round(image.Width * ratio);
                int newH = (int)Math.Round(image.Height * ratio);
                image.Mutate(x => x.Resize(newW, newH));
            }

        // We'll prefer JPEG for photographic content to get good compression even if input was PNG/HEIC.
        // If original had transparency and wasn't a photo (PNG with alpha), fall back to PNG/WebP.
        // Simple heuristic: if any pixel has alpha channel not fully opaque we treat as having alpha.
        // To avoid full scan for large images, sample a small subset of pixels.
            bool hasAlpha = false;
            using (var rgba = image.CloneAs<SixLabors.ImageSharp.PixelFormats.Rgba32>())
            {
                var frame = rgba.Frames.RootFrame;
                int sampleStepX = Math.Max(1, frame.Width / 25);
                int sampleStepY = Math.Max(1, frame.Height / 25);
                var pixels = new SixLabors.ImageSharp.PixelFormats.Rgba32[frame.Width * frame.Height];
                frame.CopyPixelDataTo(pixels);
                for (int y = 0; y < frame.Height && !hasAlpha; y += sampleStepY)
                {
                    for (int x = 0; x < frame.Width; x += sampleStepX)
                    {
                        var px = pixels[y * frame.Width + x];
                        if (px.A < 255)
                        {
                            hasAlpha = true;
                            break;
                        }
                    }
                }
            }

            // Decide target format
            IImageEncoder encoder;
            string outputContentType;
            if (hasAlpha && !contentType.Equals("image/jpeg", StringComparison.OrdinalIgnoreCase))
            {
                encoder = new PngEncoder { CompressionLevel = PngCompressionLevel.Level6 };
                outputContentType = "image/png";
            }
            else
            {
                int quality = 85;
                MemoryStream temp = new();
                await image.SaveAsync(temp, new JpegEncoder { Quality = quality }, ct);
                while (temp.Length > preferredMaxBytes && quality > 40)
                {
                    quality -= 10;
                    temp.Dispose();
                    temp = new MemoryStream();
                    await image.SaveAsync(temp, new JpegEncoder { Quality = quality }, ct);
                }
                temp.Position = 0;
                return (temp, "image/jpeg");
            }

            var ms = new MemoryStream();
            await image.SaveAsync(ms, encoder, ct);
            ms.Position = 0;
            if (ms.Length > preferredMaxBytes && outputContentType == "image/png")
            {
                ms.Dispose();
                int quality = 80;
                MemoryStream jpegAttempt = new();
                await image.SaveAsync(jpegAttempt, new JpegEncoder { Quality = quality }, ct);
                while (jpegAttempt.Length > preferredMaxBytes && quality > 40)
                {
                    quality -= 10;
                    jpegAttempt.Dispose();
                    jpegAttempt = new MemoryStream();
                    await image.SaveAsync(jpegAttempt, new JpegEncoder { Quality = quality }, ct);
                }
                jpegAttempt.Position = 0;
                return (jpegAttempt, "image/jpeg");
            }
            return (ms, outputContentType);
        }
    }
}
