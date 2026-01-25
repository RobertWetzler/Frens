using Cliq.Server.Data;
using Cliq.Server.Models;
using Cliq.Server.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using AutoMapper;
using System.Diagnostics;
using System.Collections.Concurrent;
using Xunit.Abstractions;

namespace Cliq.Server.Test;

/// <summary>
/// Tests for the recommended friends functionality.
/// These tests validate both correctness and performance of mutual friend calculations.
/// </summary>
[Collection("Database Tests")]
public class RecommendedFriendsTests : IClassFixture<DatabaseFixture>
{
    private readonly DatabaseFixture _fixture;
    private readonly IMapper _mapper;
    private readonly Mock<IObjectStorageService> _mockStorage;
    private readonly Mock<IEventNotificationService> _mockEventNotificationService;
    private readonly ITestOutputHelper _output;

    // Test users - we'll create a social network with known mutual friend counts
    private readonly Guid _mainUserId = Guid.NewGuid();
    
    // Direct friends of main user
    private readonly Guid _friend1Id = Guid.NewGuid();
    private readonly Guid _friend2Id = Guid.NewGuid();
    private readonly Guid _friend3Id = Guid.NewGuid();
    
    // Friends-of-friends (not directly connected to main user)
    private readonly Guid _fof1Id = Guid.NewGuid(); // Connected via friend1 and friend2 (2 mutual)
    private readonly Guid _fof2Id = Guid.NewGuid(); // Connected via friend1, friend2, friend3 (3 mutual)
    private readonly Guid _fof3Id = Guid.NewGuid(); // Connected via friend1 only (1 mutual)
    private readonly Guid _fof4Id = Guid.NewGuid(); // Connected via friend2 and friend3 (2 mutual)
    
    // User with pending friend request
    private readonly Guid _pendingUserId = Guid.NewGuid();
    
    // Completely unconnected user
    private readonly Guid _strangerUserId = Guid.NewGuid();

    public RecommendedFriendsTests(DatabaseFixture fixture, ITestOutputHelper output)
    {
        _fixture = fixture;
        _output = output;

        // Setup AutoMapper
        var mapperConfig = new MapperConfiguration(cfg =>
        {
            cfg.CreateMap<User, UserDto>();
        });
        _mapper = mapperConfig.CreateMapper();

        // Setup mocks
        _mockStorage = new Mock<IObjectStorageService>();
        _mockStorage.Setup(s => s.GetProfilePictureUrl(It.IsAny<string>()))
            .Returns((string key) => $"https://storage.example.com/{key}");
        
        _mockEventNotificationService = new Mock<IEventNotificationService>();
        
        // Setup test data
        SetupTestDataAsync().GetAwaiter().GetResult();
    }

    private async Task SetupTestDataAsync()
    {
        using var context = _fixture.CreateContext();
        
        // Clean any existing data
        await CleanupTestDataAsync(context);
        
        // Create all test users
        var users = new List<User>
        {
            new User("main@example.com") { Id = _mainUserId, Name = "Main User", ProfilePictureKey = "main.jpg" },
            new User("friend1@example.com") { Id = _friend1Id, Name = "Friend One" },
            new User("friend2@example.com") { Id = _friend2Id, Name = "Friend Two" },
            new User("friend3@example.com") { Id = _friend3Id, Name = "Friend Three" },
            new User("fof1@example.com") { Id = _fof1Id, Name = "FoF One (2 mutual)" },
            new User("fof2@example.com") { Id = _fof2Id, Name = "FoF Two (3 mutual)" },
            new User("fof3@example.com") { Id = _fof3Id, Name = "FoF Three (1 mutual)" },
            new User("fof4@example.com") { Id = _fof4Id, Name = "FoF Four (2 mutual)" },
            new User("pending@example.com") { Id = _pendingUserId, Name = "Pending Request" },
            new User("stranger@example.com") { Id = _strangerUserId, Name = "Stranger" }
        };
        context.Users.AddRange(users);
        
        // Create friendships
        // Main user's direct friends
        var friendships = new List<Friendship>
        {
            // Main user is friends with friend1, friend2, friend3
            new Friendship { RequesterId = _mainUserId, AddresseeId = _friend1Id, Status = FriendshipStatus.Accepted },
            new Friendship { RequesterId = _friend2Id, AddresseeId = _mainUserId, Status = FriendshipStatus.Accepted }, // Opposite direction
            new Friendship { RequesterId = _mainUserId, AddresseeId = _friend3Id, Status = FriendshipStatus.Accepted },
            
            // FoF1 is friends with friend1 and friend2 (2 mutual with main)
            new Friendship { RequesterId = _friend1Id, AddresseeId = _fof1Id, Status = FriendshipStatus.Accepted },
            new Friendship { RequesterId = _fof1Id, AddresseeId = _friend2Id, Status = FriendshipStatus.Accepted }, // Opposite direction
            
            // FoF2 is friends with friend1, friend2, and friend3 (3 mutual with main)
            new Friendship { RequesterId = _friend1Id, AddresseeId = _fof2Id, Status = FriendshipStatus.Accepted },
            new Friendship { RequesterId = _friend2Id, AddresseeId = _fof2Id, Status = FriendshipStatus.Accepted },
            new Friendship { RequesterId = _fof2Id, AddresseeId = _friend3Id, Status = FriendshipStatus.Accepted }, // Opposite direction
            
            // FoF3 is friends with friend1 only (1 mutual with main)
            new Friendship { RequesterId = _fof3Id, AddresseeId = _friend1Id, Status = FriendshipStatus.Accepted }, // Opposite direction
            
            // FoF4 is friends with friend2 and friend3 (2 mutual with main)
            new Friendship { RequesterId = _friend2Id, AddresseeId = _fof4Id, Status = FriendshipStatus.Accepted },
            new Friendship { RequesterId = _friend3Id, AddresseeId = _fof4Id, Status = FriendshipStatus.Accepted },
            
            // Pending friend request from main to pendingUser (should be excluded)
            new Friendship { RequesterId = _mainUserId, AddresseeId = _pendingUserId, Status = FriendshipStatus.Pending },
            
            // PendingUser also has mutual friends (to test exclusion)
            new Friendship { RequesterId = _friend1Id, AddresseeId = _pendingUserId, Status = FriendshipStatus.Accepted },
            new Friendship { RequesterId = _friend2Id, AddresseeId = _pendingUserId, Status = FriendshipStatus.Accepted },
            
            // Stranger has no connections to main user's network
            // (no friendships with anyone in main's network)
        };
        context.Friendships.AddRange(friendships);
        
        await context.SaveChangesAsync();
    }
    
    private async Task CleanupTestDataAsync(CliqDbContext context)
    {
        var testUserIds = new[] { _mainUserId, _friend1Id, _friend2Id, _friend3Id, 
                                   _fof1Id, _fof2Id, _fof3Id, _fof4Id, _pendingUserId, _strangerUserId };
        
        // Remove friendships involving test users
        var friendships = await context.Friendships
            .Where(f => testUserIds.Contains(f.RequesterId) || testUserIds.Contains(f.AddresseeId))
            .ToListAsync();
        context.Friendships.RemoveRange(friendships);
        
        // Remove test users
        var users = await context.Users
            .Where(u => testUserIds.Contains(u.Id))
            .ToListAsync();
        context.Users.RemoveRange(users);
        
        await context.SaveChangesAsync();
    }

    private FriendshipService CreateService(CliqDbContext context)
    {
        return new FriendshipService(context, _mapper, _mockStorage.Object, _mockEventNotificationService.Object);
    }

    #region Correctness Tests

    [Fact]
    public async Task GetRecommendedFriendsAsync_ReturnsCorrectMutualCounts()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        var service = CreateService(context);
        
        // Act
        var recommendations = await service.GetRecommendedFriendsAsync(_mainUserId, limit: 10, minimumMutualFriends: 1);
        
        // Assert
        _output.WriteLine($"Found {recommendations.Count} recommendations:");
        foreach (var rec in recommendations)
        {
            _output.WriteLine($"  - {rec.User.Name}: {rec.MutualFriendCount} mutual friends");
        }
        
        // FoF2 should have 3 mutual friends (highest)
        var fof2 = recommendations.FirstOrDefault(r => r.User.Id == _fof2Id);
        Assert.NotNull(fof2);
        Assert.Equal(3, fof2.MutualFriendCount);
        
        // FoF1 and FoF4 should have 2 mutual friends each
        var fof1 = recommendations.FirstOrDefault(r => r.User.Id == _fof1Id);
        var fof4 = recommendations.FirstOrDefault(r => r.User.Id == _fof4Id);
        Assert.NotNull(fof1);
        Assert.NotNull(fof4);
        Assert.Equal(2, fof1.MutualFriendCount);
        Assert.Equal(2, fof4.MutualFriendCount);
        
        // FoF3 should have 1 mutual friend
        var fof3 = recommendations.FirstOrDefault(r => r.User.Id == _fof3Id);
        Assert.NotNull(fof3);
        Assert.Equal(1, fof3.MutualFriendCount);
    }

    [Fact]
    public async Task GetRecommendedFriendsAsync_SortedByMutualCountDescending()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        var service = CreateService(context);
        
        // Act
        var recommendations = await service.GetRecommendedFriendsAsync(_mainUserId, limit: 10, minimumMutualFriends: 1);
        
        // Assert - should be sorted descending by mutual friend count
        var mutualCounts = recommendations.Select(r => r.MutualFriendCount).ToList();
        var sortedCounts = mutualCounts.OrderByDescending(c => c).ToList();
        Assert.Equal(sortedCounts, mutualCounts);
        
        // First should be FoF2 with 3 mutual
        Assert.Equal(_fof2Id, recommendations.First().User.Id);
    }

    [Fact]
    public async Task GetRecommendedFriendsAsync_ExcludesExistingFriends()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        var service = CreateService(context);
        
        // Act
        var recommendations = await service.GetRecommendedFriendsAsync(_mainUserId, limit: 10, minimumMutualFriends: 1);
        
        // Assert - should not include friend1, friend2, or friend3
        Assert.DoesNotContain(recommendations, r => r.User.Id == _friend1Id);
        Assert.DoesNotContain(recommendations, r => r.User.Id == _friend2Id);
        Assert.DoesNotContain(recommendations, r => r.User.Id == _friend3Id);
    }

    [Fact]
    public async Task GetRecommendedFriendsAsync_ExcludesPendingRequests()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        var service = CreateService(context);
        
        // Act
        var recommendations = await service.GetRecommendedFriendsAsync(_mainUserId, limit: 10, minimumMutualFriends: 1);
        
        // Assert - should not include user with pending request (even though they have 2 mutual friends)
        Assert.DoesNotContain(recommendations, r => r.User.Id == _pendingUserId);
        
        _output.WriteLine("Verified: Pending request user excluded despite having mutual friends");
    }

    [Fact]
    public async Task GetRecommendedFriendsAsync_ExcludesSelf()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        var service = CreateService(context);
        
        // Act
        var recommendations = await service.GetRecommendedFriendsAsync(_mainUserId, limit: 10, minimumMutualFriends: 1);
        
        // Assert - should not include self
        Assert.DoesNotContain(recommendations, r => r.User.Id == _mainUserId);
    }

    [Fact]
    public async Task GetRecommendedFriendsAsync_RespectsMinimumMutualFriends()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        var service = CreateService(context);
        
        // Act - require at least 2 mutual friends
        var recommendations = await service.GetRecommendedFriendsAsync(_mainUserId, limit: 10, minimumMutualFriends: 2);
        
        // Assert - should not include FoF3 (only 1 mutual friend)
        Assert.DoesNotContain(recommendations, r => r.User.Id == _fof3Id);
        
        // Should include FoF1, FoF2, FoF4
        Assert.Contains(recommendations, r => r.User.Id == _fof1Id);
        Assert.Contains(recommendations, r => r.User.Id == _fof2Id);
        Assert.Contains(recommendations, r => r.User.Id == _fof4Id);
        
        _output.WriteLine($"With minimum 2 mutual friends: {recommendations.Count} recommendations");
    }

    [Fact]
    public async Task GetRecommendedFriendsAsync_RespectsLimit()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        var service = CreateService(context);
        
        // Act - limit to 2 results
        var recommendations = await service.GetRecommendedFriendsAsync(_mainUserId, limit: 2, minimumMutualFriends: 1);
        
        // Assert
        Assert.Equal(2, recommendations.Count);
        
        // Should be the top 2 by mutual count (FoF2 with 3, then either FoF1 or FoF4 with 2)
        Assert.Equal(_fof2Id, recommendations[0].User.Id);
        Assert.True(recommendations[1].User.Id == _fof1Id || recommendations[1].User.Id == _fof4Id);
    }

    [Fact]
    public async Task GetRecommendedFriendsAsync_ReturnsEmptyForUserWithNoFriends()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        var service = CreateService(context);
        
        // Act - stranger has no friends
        var recommendations = await service.GetRecommendedFriendsAsync(_strangerUserId, limit: 10, minimumMutualFriends: 1);
        
        // Assert
        Assert.Empty(recommendations);
    }

    [Fact]
    public async Task GetRecommendedFriendsAsync_HandlesNonExistentUser()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        var service = CreateService(context);
        var nonExistentUserId = Guid.NewGuid();
        
        // Act
        var recommendations = await service.GetRecommendedFriendsAsync(nonExistentUserId, limit: 10, minimumMutualFriends: 1);
        
        // Assert
        Assert.Empty(recommendations);
    }

    #endregion

    #region SQL Query Counting Tests

    [Fact]
    public async Task GetRecommendedFriendsAsync_EFCore_CountsQueries()
    {
        // Arrange - create context with query logging
        var queryLog = new List<string>();
        var options = new DbContextOptionsBuilder<CliqDbContext>()
            .UseNpgsql(_fixture.CreateContext().Database.GetConnectionString())
            .LogTo(query => 
            {
                if (query.Contains("SELECT") || query.Contains("INSERT") || query.Contains("UPDATE"))
                {
                    queryLog.Add(query);
                }
            }, LogLevel.Information)
            .EnableSensitiveDataLogging()
            .Options;
        
        using var context = new CliqDbContext(options, new Microsoft.Extensions.Hosting.Internal.HostingEnvironment { EnvironmentName = "Testing" });
        var service = CreateService(context);
        
        // Act
        var recommendations = await service.GetRecommendedFriendsAsync(_mainUserId, limit: 5, minimumMutualFriends: 2);
        
        // Log the queries
        _output.WriteLine($"\n=== EF Core Implementation: {queryLog.Count} queries executed ===\n");
        for (int i = 0; i < queryLog.Count; i++)
        {
            _output.WriteLine($"Query {i + 1}:");
            _output.WriteLine(queryLog[i]);
            _output.WriteLine("");
        }
        
        // Assert - document the query count
        _output.WriteLine($"Total SELECT queries: {queryLog.Count(q => q.Contains("SELECT"))}");
        
        Assert.NotEmpty(recommendations);
    }

    #endregion

    #region Performance Tests

    [Fact]
    public async Task GetRecommendedFriendsAsync_Performance_SmallNetwork()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        var service = CreateService(context);
        
        // Warm up
        await service.GetRecommendedFriendsAsync(_mainUserId, limit: 5, minimumMutualFriends: 2);
        
        // Act - measure 10 iterations
        var stopwatch = Stopwatch.StartNew();
        const int iterations = 10;
        
        for (int i = 0; i < iterations; i++)
        {
            await service.GetRecommendedFriendsAsync(_mainUserId, limit: 5, minimumMutualFriends: 2);
        }
        
        stopwatch.Stop();
        var avgMs = stopwatch.ElapsedMilliseconds / (double)iterations;
        
        // Assert & Log
        _output.WriteLine($"\n=== Performance: Small Network (10 users) ===");
        _output.WriteLine($"Average time per call: {avgMs:F2}ms");
        _output.WriteLine($"Total time for {iterations} iterations: {stopwatch.ElapsedMilliseconds}ms");
        
        // Soft assertion - should be reasonably fast
        Assert.True(avgMs < 500, $"Expected average time < 500ms, but was {avgMs:F2}ms");
    }

    [Fact]
    public async Task GetRecommendedFriendsAsync_Performance_LargerNetwork()
    {
        // Arrange - create a larger test network
        using var context = _fixture.CreateContext();
        
        var largeTestUserId = Guid.NewGuid();
        var friendIds = Enumerable.Range(0, 50).Select(_ => Guid.NewGuid()).ToList();
        var fofIds = Enumerable.Range(0, 200).Select(_ => Guid.NewGuid()).ToList();
        
        // Create users
        var users = new List<User>
        {
            new User($"large_test@example.com") { Id = largeTestUserId, Name = "Large Test User" }
        };
        users.AddRange(friendIds.Select((id, i) => new User($"friend{i}@large.com") { Id = id, Name = $"Friend {i}" }));
        users.AddRange(fofIds.Select((id, i) => new User($"fof{i}@large.com") { Id = id, Name = $"FoF {i}" }));
        
        context.Users.AddRange(users);
        
        // Create friendships
        var friendships = new List<Friendship>();
        
        // Large test user is friends with all 50 friends
        foreach (var friendId in friendIds)
        {
            friendships.Add(new Friendship 
            { 
                RequesterId = largeTestUserId, 
                AddresseeId = friendId, 
                Status = FriendshipStatus.Accepted 
            });
        }
        
        // Each FoF is randomly connected to 1-10 of the friends
        var random = new Random(42); // Fixed seed for reproducibility
        foreach (var fofId in fofIds)
        {
            var numConnections = random.Next(1, 11);
            var connectedFriends = friendIds.OrderBy(_ => random.Next()).Take(numConnections).ToList();
            
            foreach (var friendId in connectedFriends)
            {
                friendships.Add(new Friendship
                {
                    RequesterId = friendId,
                    AddresseeId = fofId,
                    Status = FriendshipStatus.Accepted
                });
            }
        }
        
        context.Friendships.AddRange(friendships);
        await context.SaveChangesAsync();
        
        try
        {
            var service = CreateService(context);
            
            // Warm up
            await service.GetRecommendedFriendsAsync(largeTestUserId, limit: 5, minimumMutualFriends: 2);
            
            // Act - measure 5 iterations
            var stopwatch = Stopwatch.StartNew();
            const int iterations = 5;
            List<RecommendedFriendDto>? results = null;
            
            for (int i = 0; i < iterations; i++)
            {
                results = await service.GetRecommendedFriendsAsync(largeTestUserId, limit: 5, minimumMutualFriends: 2);
            }
            
            stopwatch.Stop();
            var avgMs = stopwatch.ElapsedMilliseconds / (double)iterations;
            
            // Log results
            _output.WriteLine($"\n=== Performance: Large Network (50 friends, 200 FoFs) ===");
            _output.WriteLine($"Average time per call: {avgMs:F2}ms");
            _output.WriteLine($"Total time for {iterations} iterations: {stopwatch.ElapsedMilliseconds}ms");
            _output.WriteLine($"\nTop recommendations:");
            foreach (var rec in results!.Take(5))
            {
                _output.WriteLine($"  - {rec.User.Name}: {rec.MutualFriendCount} mutual friends");
            }
            
            // Soft assertion - should complete in reasonable time even with larger network
            Assert.True(avgMs < 2000, $"Expected average time < 2000ms, but was {avgMs:F2}ms");
        }
        finally
        {
            // Cleanup
            var testUserIds = new[] { largeTestUserId }.Concat(friendIds).Concat(fofIds).ToList();
            var toRemoveFriendships = await context.Friendships
                .Where(f => testUserIds.Contains(f.RequesterId) || testUserIds.Contains(f.AddresseeId))
                .ToListAsync();
            context.Friendships.RemoveRange(toRemoveFriendships);
            
            var toRemoveUsers = await context.Users
                .Where(u => testUserIds.Contains(u.Id))
                .ToListAsync();
            context.Users.RemoveRange(toRemoveUsers);
            
            await context.SaveChangesAsync();
        }
    }

    #endregion

    #region Implementation Comparison Tests

    [Fact]
    public async Task CompareImplementations_BothReturnSameResults()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        var service = CreateService(context);
        
        // Act
        var efCoreResults = await service.GetRecommendedFriendsAsync(_mainUserId, limit: 10, minimumMutualFriends: 1);
        var rawSqlResults = await service.GetRecommendedFriendsRawSqlAsync(_mainUserId, limit: 10, minimumMutualFriends: 1);
        
        // Assert - both should return the same users with the same mutual counts
        _output.WriteLine("=== Comparing EF Core vs Raw SQL Results ===\n");
        
        _output.WriteLine("EF Core Results:");
        foreach (var rec in efCoreResults)
        {
            _output.WriteLine($"  - {rec.User.Id}: {rec.User.Name} ({rec.MutualFriendCount} mutual)");
        }
        
        _output.WriteLine("\nRaw SQL Results:");
        foreach (var rec in rawSqlResults)
        {
            _output.WriteLine($"  - {rec.User.Id}: {rec.User.Name} ({rec.MutualFriendCount} mutual)");
        }
        
        // Same count
        Assert.Equal(efCoreResults.Count, rawSqlResults.Count);
        
        // Same users with same mutual counts (order may differ for ties)
        var efCoreDict = efCoreResults.ToDictionary(r => r.User.Id, r => r.MutualFriendCount);
        var rawSqlDict = rawSqlResults.ToDictionary(r => r.User.Id, r => r.MutualFriendCount);
        
        foreach (var (userId, mutualCount) in efCoreDict)
        {
            Assert.True(rawSqlDict.ContainsKey(userId), $"Raw SQL missing user {userId}");
            Assert.Equal(mutualCount, rawSqlDict[userId]);
        }
        
        _output.WriteLine("\n✓ Both implementations return identical results!");
    }

    [Fact]
    public async Task CompareImplementations_RawSQL_UsesFewerQueries()
    {
        // Arrange - create context with query logging for EF Core
        var efCoreQueryLog = new List<string>();
        var optionsEf = new DbContextOptionsBuilder<CliqDbContext>()
            .UseNpgsql(_fixture.CreateContext().Database.GetConnectionString())
            .LogTo(query => 
            {
                if (query.Contains("SELECT"))
                {
                    efCoreQueryLog.Add(query);
                }
            }, LogLevel.Information)
            .EnableSensitiveDataLogging()
            .Options;
        
        using var efContext = new CliqDbContext(optionsEf, new Microsoft.Extensions.Hosting.Internal.HostingEnvironment { EnvironmentName = "Testing" });
        var efService = CreateService(efContext);
        
        // Run EF Core implementation
        await efService.GetRecommendedFriendsAsync(_mainUserId, limit: 5, minimumMutualFriends: 2);
        var efCoreQueryCount = efCoreQueryLog.Count(q => q.Contains("SELECT"));
        
        // Create context with query logging for Raw SQL
        var rawSqlQueryLog = new List<string>();
        var optionsSql = new DbContextOptionsBuilder<CliqDbContext>()
            .UseNpgsql(_fixture.CreateContext().Database.GetConnectionString())
            .LogTo(query => 
            {
                if (query.Contains("SELECT"))
                {
                    rawSqlQueryLog.Add(query);
                }
            }, LogLevel.Information)
            .EnableSensitiveDataLogging()
            .Options;
        
        using var sqlContext = new CliqDbContext(optionsSql, new Microsoft.Extensions.Hosting.Internal.HostingEnvironment { EnvironmentName = "Testing" });
        var sqlService = CreateService(sqlContext);
        
        // Run Raw SQL implementation
        await sqlService.GetRecommendedFriendsRawSqlAsync(_mainUserId, limit: 5, minimumMutualFriends: 2);
        var rawSqlQueryCount = rawSqlQueryLog.Count(q => q.Contains("SELECT"));
        
        // Log results
        _output.WriteLine("=== Query Count Comparison ===\n");
        _output.WriteLine($"EF Core implementation: {efCoreQueryCount} SELECT queries");
        _output.WriteLine($"Raw SQL implementation: {rawSqlQueryCount} SELECT query");
        
        // Assert - Raw SQL should use fewer queries (ideally just 1)
        Assert.True(rawSqlQueryCount <= efCoreQueryCount, 
            $"Expected Raw SQL ({rawSqlQueryCount}) to use <= queries than EF Core ({efCoreQueryCount})");
        
        _output.WriteLine($"\n✓ Raw SQL uses {efCoreQueryCount - rawSqlQueryCount} fewer queries!");
    }

    [Fact]
    public async Task CompareImplementations_Performance()
    {
        // Arrange
        using var context = _fixture.CreateContext();
        var service = CreateService(context);
        const int iterations = 20;
        
        // Warm up both
        await service.GetRecommendedFriendsAsync(_mainUserId, limit: 5, minimumMutualFriends: 2);
        await service.GetRecommendedFriendsRawSqlAsync(_mainUserId, limit: 5, minimumMutualFriends: 2);
        
        // Measure EF Core
        var efStopwatch = Stopwatch.StartNew();
        for (int i = 0; i < iterations; i++)
        {
            await service.GetRecommendedFriendsAsync(_mainUserId, limit: 5, minimumMutualFriends: 2);
        }
        efStopwatch.Stop();
        var efAvgMs = efStopwatch.ElapsedMilliseconds / (double)iterations;
        
        // Measure Raw SQL
        var sqlStopwatch = Stopwatch.StartNew();
        for (int i = 0; i < iterations; i++)
        {
            await service.GetRecommendedFriendsRawSqlAsync(_mainUserId, limit: 5, minimumMutualFriends: 2);
        }
        sqlStopwatch.Stop();
        var sqlAvgMs = sqlStopwatch.ElapsedMilliseconds / (double)iterations;
        
        // Log results
        _output.WriteLine("=== Performance Comparison ===\n");
        _output.WriteLine($"EF Core implementation: {efAvgMs:F2}ms average ({iterations} iterations)");
        _output.WriteLine($"Raw SQL implementation: {sqlAvgMs:F2}ms average ({iterations} iterations)");
        
        var percentDiff = ((efAvgMs - sqlAvgMs) / efAvgMs) * 100;
        if (sqlAvgMs < efAvgMs)
        {
            _output.WriteLine($"\n✓ Raw SQL is {percentDiff:F1}% faster");
        }
        else
        {
            _output.WriteLine($"\n⚠ EF Core is {-percentDiff:F1}% faster (unexpected!)");
        }
        
        // Just verify both work (no strict performance assertion)
        Assert.True(efAvgMs < 1000 && sqlAvgMs < 1000, "Both implementations should complete in under 1s");
    }

    [Fact]
    public async Task CompareImplementations_LargeNetwork_Performance()
    {
        // Arrange - create a larger test network
        using var context = _fixture.CreateContext();
        
        var largeTestUserId = Guid.NewGuid();
        var friendIds = Enumerable.Range(0, 50).Select(_ => Guid.NewGuid()).ToList();
        var fofIds = Enumerable.Range(0, 200).Select(_ => Guid.NewGuid()).ToList();
        
        // Create users
        var users = new List<User>
        {
            new User($"compare_large@example.com") { Id = largeTestUserId, Name = "Compare Large Test User" }
        };
        users.AddRange(friendIds.Select((id, i) => new User($"cf{i}@compare.com") { Id = id, Name = $"Compare Friend {i}" }));
        users.AddRange(fofIds.Select((id, i) => new User($"cfof{i}@compare.com") { Id = id, Name = $"Compare FoF {i}" }));
        
        context.Users.AddRange(users);
        
        // Create friendships
        var friendships = new List<Friendship>();
        foreach (var friendId in friendIds)
        {
            friendships.Add(new Friendship 
            { 
                RequesterId = largeTestUserId, 
                AddresseeId = friendId, 
                Status = FriendshipStatus.Accepted 
            });
        }
        
        var random = new Random(123); // Fixed seed
        foreach (var fofId in fofIds)
        {
            var numConnections = random.Next(1, 11);
            var connectedFriends = friendIds.OrderBy(_ => random.Next()).Take(numConnections).ToList();
            
            foreach (var friendId in connectedFriends)
            {
                friendships.Add(new Friendship
                {
                    RequesterId = friendId,
                    AddresseeId = fofId,
                    Status = FriendshipStatus.Accepted
                });
            }
        }
        
        context.Friendships.AddRange(friendships);
        await context.SaveChangesAsync();
        
        try
        {
            var service = CreateService(context);
            const int iterations = 5;
            
            // Warm up
            await service.GetRecommendedFriendsAsync(largeTestUserId, limit: 5, minimumMutualFriends: 2);
            await service.GetRecommendedFriendsRawSqlAsync(largeTestUserId, limit: 5, minimumMutualFriends: 2);
            
            // Measure EF Core
            var efStopwatch = Stopwatch.StartNew();
            for (int i = 0; i < iterations; i++)
            {
                await service.GetRecommendedFriendsAsync(largeTestUserId, limit: 5, minimumMutualFriends: 2);
            }
            efStopwatch.Stop();
            var efAvgMs = efStopwatch.ElapsedMilliseconds / (double)iterations;
            
            // Measure Raw SQL
            var sqlStopwatch = Stopwatch.StartNew();
            for (int i = 0; i < iterations; i++)
            {
                await service.GetRecommendedFriendsRawSqlAsync(largeTestUserId, limit: 5, minimumMutualFriends: 2);
            }
            sqlStopwatch.Stop();
            var sqlAvgMs = sqlStopwatch.ElapsedMilliseconds / (double)iterations;
            
            // Log results
            _output.WriteLine("=== Large Network Performance Comparison (50 friends, 200 FoFs) ===\n");
            _output.WriteLine($"EF Core implementation: {efAvgMs:F2}ms average ({iterations} iterations)");
            _output.WriteLine($"Raw SQL implementation: {sqlAvgMs:F2}ms average ({iterations} iterations)");
            
            var percentDiff = ((efAvgMs - sqlAvgMs) / efAvgMs) * 100;
            if (sqlAvgMs < efAvgMs)
            {
                _output.WriteLine($"\n✓ Raw SQL is {percentDiff:F1}% faster on large network");
            }
            else
            {
                _output.WriteLine($"\n⚠ EF Core is {-percentDiff:F1}% faster (unexpected!)");
            }
            
            Assert.True(efAvgMs < 5000 && sqlAvgMs < 5000, "Both should complete in reasonable time");
        }
        finally
        {
            // Cleanup
            var testUserIds = new[] { largeTestUserId }.Concat(friendIds).Concat(fofIds).ToList();
            var toRemoveFriendships = await context.Friendships
                .Where(f => testUserIds.Contains(f.RequesterId) || testUserIds.Contains(f.AddresseeId))
                .ToListAsync();
            context.Friendships.RemoveRange(toRemoveFriendships);
            
            var toRemoveUsers = await context.Users
                .Where(u => testUserIds.Contains(u.Id))
                .ToListAsync();
            context.Users.RemoveRange(toRemoveUsers);
            
            await context.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task RawSql_CorrectMutualCounts()
    {
        // Same as EF Core test, but for raw SQL implementation
        using var context = _fixture.CreateContext();
        var service = CreateService(context);
        
        // Act
        var recommendations = await service.GetRecommendedFriendsRawSqlAsync(_mainUserId, limit: 10, minimumMutualFriends: 1);
        
        // Assert
        _output.WriteLine($"[Raw SQL] Found {recommendations.Count} recommendations:");
        foreach (var rec in recommendations)
        {
            _output.WriteLine($"  - {rec.User.Name}: {rec.MutualFriendCount} mutual friends");
        }
        
        var fof2 = recommendations.FirstOrDefault(r => r.User.Id == _fof2Id);
        Assert.NotNull(fof2);
        Assert.Equal(3, fof2.MutualFriendCount);
        
        var fof1 = recommendations.FirstOrDefault(r => r.User.Id == _fof1Id);
        var fof4 = recommendations.FirstOrDefault(r => r.User.Id == _fof4Id);
        Assert.NotNull(fof1);
        Assert.NotNull(fof4);
        Assert.Equal(2, fof1.MutualFriendCount);
        Assert.Equal(2, fof4.MutualFriendCount);
        
        var fof3 = recommendations.FirstOrDefault(r => r.User.Id == _fof3Id);
        Assert.NotNull(fof3);
        Assert.Equal(1, fof3.MutualFriendCount);
    }

    [Fact]
    public async Task RawSql_ExcludesPendingAndExistingFriends()
    {
        using var context = _fixture.CreateContext();
        var service = CreateService(context);
        
        // Act
        var recommendations = await service.GetRecommendedFriendsRawSqlAsync(_mainUserId, limit: 10, minimumMutualFriends: 1);
        
        // Assert - should not include existing friends
        Assert.DoesNotContain(recommendations, r => r.User.Id == _friend1Id);
        Assert.DoesNotContain(recommendations, r => r.User.Id == _friend2Id);
        Assert.DoesNotContain(recommendations, r => r.User.Id == _friend3Id);
        
        // Should not include self
        Assert.DoesNotContain(recommendations, r => r.User.Id == _mainUserId);
        
        // Should not include pending request user
        Assert.DoesNotContain(recommendations, r => r.User.Id == _pendingUserId);
        
        _output.WriteLine("✓ Raw SQL correctly excludes pending requests and existing friends");
    }

    #endregion
}
