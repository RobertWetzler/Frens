using System.Collections.Concurrent;
using System.Text.Json;

namespace Cliq.Server.Services;

/// <summary>
/// Reverse geocodes lat/lng to city/country using LocationIQ.
/// Results are cached in-memory by cell (row, col) so repeated lookups for
/// the same cell never hit the API again.
/// </summary>
public interface ICityLookupService
{
    Task<CityLookupResult> LookupAsync(double latitude, double longitude, long cellRow, long cellCol);
}

public record CityLookupResult(string? City, string? Country);

public class CityLookupService : ICityLookupService
{
    private readonly HttpClient _http;
    private readonly string? _apiKey;
    private readonly ILogger<CityLookupService> _logger;

    // In-memory cache keyed by "row,col" — survives for the lifetime of the app.
    // Safe because a cell's city never changes.
    private readonly ConcurrentDictionary<string, CityLookupResult> _cache = new();

    public CityLookupService(IConfiguration configuration, ILogger<CityLookupService> logger)
    {
        _logger = logger;
        _apiKey = configuration["LocationIQ:ApiKey"]
            ?? Environment.GetEnvironmentVariable("LOCATIONIQ_API_KEY");

        _http = new HttpClient
        {
            BaseAddress = new Uri("https://us1.locationiq.com"),
            Timeout = TimeSpan.FromSeconds(5),
        };
    }

    public async Task<CityLookupResult> LookupAsync(double latitude, double longitude, long cellRow, long cellCol)
    {
        var cacheKey = $"{cellRow},{cellCol}";

        if (_cache.TryGetValue(cacheKey, out var cached))
            return cached;

        if (string.IsNullOrEmpty(_apiKey))
        {
            _logger.LogWarning("LocationIQ API key not configured — skipping reverse geocode");
            return new CityLookupResult(null, null);
        }

        try
        {
            var url = $"/v1/reverse?key={_apiKey}&lat={latitude}&lon={longitude}&format=json&normalizeaddress=1";
            var response = await _http.GetAsync(url);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("LocationIQ returned {Status} for ({Lat}, {Lng})",
                    response.StatusCode, latitude, longitude);
                return new CityLookupResult(null, null);
            }

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var address = doc.RootElement.GetProperty("address");

            // LocationIQ returns city in several fields depending on the area
            string? city = null;
            foreach (var field in new[] { "city", "town", "village", "municipality", "county" })
            {
                if (address.TryGetProperty(field, out var val))
                {
                    city = val.GetString();
                    break;
                }
            }

            string? country = address.TryGetProperty("country", out var countryVal)
                ? countryVal.GetString()
                : null;

            var result = new CityLookupResult(city, country);
            _cache.TryAdd(cacheKey, result);
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Reverse geocode failed for ({Lat}, {Lng})", latitude, longitude);
            return new CityLookupResult(null, null);
        }
    }

    /// <summary>
    /// Warm the cache from DB data so we never re-call the API for cells
    /// that already have city/country stored.
    /// </summary>
    public void WarmCache(long cellRow, long cellCol, string? city, string? country)
    {
        if (city != null || country != null)
        {
            _cache.TryAdd($"{cellRow},{cellCol}", new CityLookupResult(city, country));
        }
    }
}
