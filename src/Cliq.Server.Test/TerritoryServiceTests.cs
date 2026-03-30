using Cliq.Server.Data;
using Cliq.Server.Models;
using Cliq.Server.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;

namespace Cliq.Server.Test;

[Collection("Database Tests")]
public class TerritoryServiceTests : IClassFixture<DatabaseFixture>
{
    private readonly DatabaseFixture _fixture;
    private readonly Mock<ICityLookupService> _mockCityLookup;
    private readonly Mock<ILogger<TerritoryService>> _mockLogger;

    private readonly Guid _userId1 = Guid.NewGuid();
    private readonly Guid _userId2 = Guid.NewGuid();
    private readonly Guid _userId3 = Guid.NewGuid();

    public TerritoryServiceTests(DatabaseFixture fixture)
    {
        _fixture = fixture;
        _mockCityLookup = new Mock<ICityLookupService>();
        _mockLogger = new Mock<ILogger<TerritoryService>>();
    }

    private TerritoryService CreateService(CliqDbContext context)
    {
        return new TerritoryService(context, _mockCityLookup.Object, _mockLogger.Object);
    }

    private async Task SeedUsersAndPlayers(CliqDbContext context)
    {
        context.Users.AddRange(
            new User("territory-user1@test.com") { Id = _userId1, Name = "Alice" },
            new User("territory-user2@test.com") { Id = _userId2, Name = "Bob" },
            new User("territory-user3@test.com") { Id = _userId3, Name = "Charlie" }
        );

        context.TerritoryPlayers.AddRange(
            new TerritoryPlayer { UserId = _userId1, Color = "#FF0000" },
            new TerritoryPlayer { UserId = _userId2, Color = "#00FF00" },
            new TerritoryPlayer { UserId = _userId3, Color = "#0000FF" }
        );

        await context.SaveChangesAsync();
    }

    private async Task SeedClaims(CliqDbContext context, IEnumerable<TerritoryClaim> claims)
    {
        context.TerritoryClaims.AddRange(claims);
        await context.SaveChangesAsync();
    }

    // ─── GetLeaderboardRegion unit tests ───

    [Theory]
    [InlineData("Seattle", "United States", "Seattle")]
    [InlineData("Portland", "United States of America", "Portland")]
    [InlineData("New York", "US", "New York")]
    [InlineData("Chicago", "USA", "Chicago")]
    [InlineData(null, "United States", "United States")]
    [InlineData("Tokyo", "Japan", "Japan")]
    [InlineData("London", "United Kingdom", "United Kingdom")]
    [InlineData("Paris", "France", "France")]
    [InlineData("Toronto", "Canada", "Canada")]
    [InlineData(null, "Germany", "Germany")]
    [InlineData(null, null, "Unknown")]
    [InlineData("SomeCity", null, "SomeCity")]
    public void GetLeaderboardRegion_ReturnsCorrectRegion(string? city, string? country, string expected)
    {
        var result = TerritoryService.GetLeaderboardRegion(city, country);
        Assert.Equal(expected, result);
    }

    // ─── Leaderboard integration tests ───

    [Fact]
    public async Task GetCityLeaderboard_GroupsUsCellsByCity_NonUsByCountry()
    {
        using var context = _fixture.CreateContext();
        await using var transaction = await context.Database.BeginTransactionAsync();

        try
        {
            await SeedUsersAndPlayers(context);

            // Alice: 3 cells in Seattle (US), 2 cells in Japan
            // Bob: 2 cells in Seattle (US), 1 cell in Japan
            // Charlie: 1 cell in London (UK)
            await SeedClaims(context, new[]
            {
                MakeClaim(_userId1, 1, 1, "Seattle", "United States", "#FF0000"),
                MakeClaim(_userId1, 1, 2, "Seattle", "United States", "#FF0000"),
                MakeClaim(_userId1, 1, 3, "Seattle", "United States", "#FF0000"),
                MakeClaim(_userId1, 2, 1, "Tokyo", "Japan", "#FF0000"),
                MakeClaim(_userId1, 2, 2, "Osaka", "Japan", "#FF0000"),
                MakeClaim(_userId2, 1, 4, "Seattle", "United States", "#00FF00"),
                MakeClaim(_userId2, 1, 5, "Seattle", "United States", "#00FF00"),
                MakeClaim(_userId2, 2, 3, "Yokohama", "Japan", "#00FF00"),
                MakeClaim(_userId3, 3, 1, "London", "United Kingdom", "#0000FF"),
            });

            var service = CreateService(context);
            var result = await service.GetCityLeaderboardAsync(_userId1);

            // Should have 3 sections: Seattle, Japan, United Kingdom
            Assert.Equal(3, result.Cities.Count);

            // Seattle section (US city — grouped by city name)
            var seattle = result.Cities.First(c => c.City == "Seattle");
            Assert.Equal(2, seattle.Players.Count);
            Assert.Equal("Alice", seattle.Players[0].DisplayName); // 3 cells
            Assert.Equal(3, seattle.Players[0].CellsClaimed);
            Assert.Equal("Bob", seattle.Players[1].DisplayName); // 2 cells
            Assert.Equal(2, seattle.Players[1].CellsClaimed);

            // Japan section (non-US — grouped by country, not by individual cities)
            var japan = result.Cities.First(c => c.City == "Japan");
            Assert.Equal(2, japan.Players.Count);
            Assert.Equal("Alice", japan.Players[0].DisplayName); // 2 cells (Tokyo + Osaka)
            Assert.Equal(2, japan.Players[0].CellsClaimed);
            Assert.Equal("Bob", japan.Players[1].DisplayName); // 1 cell (Yokohama)
            Assert.Equal(1, japan.Players[1].CellsClaimed);

            // UK section
            var uk = result.Cities.First(c => c.City == "United Kingdom");
            Assert.Single(uk.Players);
            Assert.Equal("Charlie", uk.Players[0].DisplayName);
        }
        finally
        {
            await transaction.RollbackAsync();
        }
    }

    [Fact]
    public async Task GetCityLeaderboard_UserCitiesSortedFirst()
    {
        using var context = _fixture.CreateContext();
        await using var transaction = await context.Database.BeginTransactionAsync();

        try
        {
            await SeedUsersAndPlayers(context);

            // Alice only has claims in "Japan" (non-US)
            // Bob has more claims in Seattle
            await SeedClaims(context, new[]
            {
                MakeClaim(_userId1, 10, 1, "Tokyo", "Japan", "#FF0000"),
                MakeClaim(_userId2, 10, 2, "Seattle", "United States", "#00FF00"),
                MakeClaim(_userId2, 10, 3, "Seattle", "United States", "#00FF00"),
                MakeClaim(_userId2, 10, 4, "Seattle", "United States", "#00FF00"),
            });

            var service = CreateService(context);

            // When requesting as Alice, Japan should come first
            var result = await service.GetCityLeaderboardAsync(_userId1);
            Assert.Equal("Japan", result.Cities[0].City);
            Assert.True(result.Cities[0].UserHasClaims);
            Assert.Equal("Seattle", result.Cities[1].City);
            Assert.False(result.Cities[1].UserHasClaims);
        }
        finally
        {
            await transaction.RollbackAsync();
        }
    }

    [Fact]
    public async Task GetCityLeaderboard_NullCityAndCountry_GroupedAsUnknown()
    {
        using var context = _fixture.CreateContext();
        await using var transaction = await context.Database.BeginTransactionAsync();

        try
        {
            await SeedUsersAndPlayers(context);

            await SeedClaims(context, new[]
            {
                MakeClaim(_userId1, 20, 1, null, null, "#FF0000"),
                MakeClaim(_userId1, 20, 2, null, null, "#FF0000"),
            });

            var service = CreateService(context);
            var result = await service.GetCityLeaderboardAsync(_userId1);

            Assert.Single(result.Cities);
            Assert.Equal("Unknown", result.Cities[0].City);
            Assert.Equal(2, result.Cities[0].Players[0].CellsClaimed);
        }
        finally
        {
            await transaction.RollbackAsync();
        }
    }

    // ─── E2E tests with real LocationIQ API ───

    private CityLookupService CreateRealCityLookupService()
    {
        var apiKey = Environment.GetEnvironmentVariable("LOCATIONIQ_API_KEY");
        var config = new Microsoft.Extensions.Configuration.ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["LocationIQ:ApiKey"] = apiKey,
            })
            .Build();
        var logger = new Mock<ILogger<CityLookupService>>();
        return new CityLookupService(config, logger.Object);
    }

    [Fact]
    public async Task E2E_ReverseGeocode_SeattleReturnsUSCity()
    {
        var apiKey = Environment.GetEnvironmentVariable("LOCATIONIQ_API_KEY");
        if (string.IsNullOrEmpty(apiKey))
        {
            // Skip in CI or environments without the key
            return;
        }

        var cityLookup = CreateRealCityLookupService();

        // Pike Place Market, Seattle
        var result = await cityLookup.LookupAsync(47.6097, -122.3421, 99990, 99990);

        Assert.NotNull(result.City);
        Assert.NotNull(result.Country);
        Assert.Equal("Seattle", result.City);
        Assert.Contains("United States", result.Country!);

        // Verify leaderboard region is city name for US
        var region = TerritoryService.GetLeaderboardRegion(result.City, result.Country);
        Assert.Equal("Seattle", region);
    }

    [Fact]
    public async Task E2E_ReverseGeocode_TokyoReturnsJapanCountry()
    {
        var apiKey = Environment.GetEnvironmentVariable("LOCATIONIQ_API_KEY");
        if (string.IsNullOrEmpty(apiKey))
            return;

        var cityLookup = CreateRealCityLookupService();

        // Shibuya Crossing, Tokyo
        var result = await cityLookup.LookupAsync(35.6595, 139.7004, 99991, 99991);

        Assert.NotNull(result.Country);
        Assert.Equal("Japan", result.Country);

        // Leaderboard region should be country for non-US
        var region = TerritoryService.GetLeaderboardRegion(result.City, result.Country);
        Assert.Equal("Japan", region);
    }

    [Fact]
    public async Task E2E_ReverseGeocode_LondonReturnsUKCountry()
    {
        var apiKey = Environment.GetEnvironmentVariable("LOCATIONIQ_API_KEY");
        if (string.IsNullOrEmpty(apiKey))
            return;

        var cityLookup = CreateRealCityLookupService();

        // Big Ben, London
        var result = await cityLookup.LookupAsync(51.5007, -0.1246, 99992, 99992);

        Assert.NotNull(result.Country);
        Assert.Equal("United Kingdom", result.Country);

        var region = TerritoryService.GetLeaderboardRegion(result.City, result.Country);
        Assert.Equal("United Kingdom", region);
    }

    [Fact]
    public async Task E2E_ReverseGeocode_CachePreventsDoubleCall()
    {
        var apiKey = Environment.GetEnvironmentVariable("LOCATIONIQ_API_KEY");
        if (string.IsNullOrEmpty(apiKey))
            return;

        var cityLookup = CreateRealCityLookupService();

        // First call — hits API
        var result1 = await cityLookup.LookupAsync(47.6097, -122.3421, 99993, 99993);
        // Second call — same cell key, should return cached
        var result2 = await cityLookup.LookupAsync(47.6097, -122.3421, 99993, 99993);

        Assert.Equal(result1.City, result2.City);
        Assert.Equal(result1.Country, result2.Country);
    }

    [Fact]
    public async Task E2E_ClaimCell_StoresGeocodedCity()
    {
        var apiKey = Environment.GetEnvironmentVariable("LOCATIONIQ_API_KEY");
        if (string.IsNullOrEmpty(apiKey))
            return;

        using var context = _fixture.CreateContext();
        await using var transaction = await context.Database.BeginTransactionAsync();

        try
        {
            // Seed just one user+player
            context.Users.Add(new User("e2e-geo@test.com") { Id = _userId1, Name = "GeoUser" });
            context.TerritoryPlayers.Add(new TerritoryPlayer { UserId = _userId1, Color = "#FF0000" });
            await context.SaveChangesAsync();

            var cityLookup = CreateRealCityLookupService();
            var service = new TerritoryService(context, cityLookup, _mockLogger.Object);

            // Claim a cell in Seattle (Space Needle area)
            var cell = await service.ClaimCellAsync(_userId1, 47.6205, -122.3493);

            Assert.Equal("Seattle", cell.City);

            // Verify it persisted to DB
            var dbClaim = await context.TerritoryClaims
                .FirstOrDefaultAsync(c => c.CellRow == cell.Row && c.CellCol == cell.Col);
            Assert.NotNull(dbClaim);
            Assert.Equal("Seattle", dbClaim!.City);
            Assert.Contains("United States", dbClaim.Country!);
        }
        finally
        {
            await transaction.RollbackAsync();
        }
    }

    // ─── Helpers ───

    private static TerritoryClaim MakeClaim(Guid userId, long row, long col, string? city, string? country, string color)
    {
        var bucketRow = row >= 0 ? row / 32 : (row - 31) / 32;
        var bucketCol = col >= 0 ? col / 32 : (col - 31) / 32;
        return new TerritoryClaim
        {
            CellRow = row,
            CellCol = col,
            Bucket = $"{bucketRow}:{bucketCol}",
            ClaimedByUserId = userId,
            Color = color,
            City = city,
            Country = country,
            ClaimedAt = DateTime.UtcNow,
        };
    }
}
