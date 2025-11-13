using Cliq.Server.Data;
using Microsoft.EntityFrameworkCore;

namespace Cliq.Server.Services;

/// <summary>
/// Background service that periodically updates database-derived metrics
/// </summary>
public class MetricsBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<MetricsBackgroundService> _logger;
    private readonly TimeSpan _updateInterval = TimeSpan.FromMinutes(10);

    public MetricsBackgroundService(
        IServiceProvider serviceProvider,
        ILogger<MetricsBackgroundService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Metrics background service started");

        // Wait a bit before first update to allow app to fully initialize
        await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await UpdateMetricsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating metrics");
            }

            await Task.Delay(_updateInterval, stoppingToken);
        }

        _logger.LogInformation("Metrics background service stopped");
    }

    private async Task UpdateMetricsAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<CliqDbContext>();
        var metricsService = scope.ServiceProvider.GetRequiredService<MetricsService>();
        var activityService = scope.ServiceProvider.GetRequiredService<UserActivityService>();

        // Cleanup old activity data (older than 30 days)
        await activityService.CleanupOldActivitiesAsync(cancellationToken);

        // Update total users count
        var userCount = await dbContext.Users.CountAsync(cancellationToken);
        metricsService.SetTotalUsers(userCount);

        // Update total posts count
        var postCount = await dbContext.Posts.CountAsync(cancellationToken);
        metricsService.SetTotalPosts(postCount);

        // Update total images count (sum of all ImageObjectKeys across all posts)
        var imageCount = await dbContext.Posts
            .Select(p => p.ImageObjectKeys.Count)
            .SumAsync(cancellationToken);
        metricsService.SetTotalImages(imageCount);

        // Update total comments count
        var commentCount = await dbContext.Comments.CountAsync(cancellationToken);
        metricsService.SetTotalComments(commentCount);

        // Update per-user image counts
        var imagesByUser = await dbContext.Posts
            .Where(p => p.ImageObjectKeys.Count > 0)
            .GroupBy(p => new { p.UserId, p.User.Name })
            .Select(g => new
            {
                UserId = g.Key.UserId,
                UserName = g.Key.Name,
                ImageCount = g.Sum(p => p.ImageObjectKeys.Count)
            })
            .ToListAsync(cancellationToken);

        // Set per-user image metrics
        foreach (var userImages in imagesByUser)
        {
            metricsService.SetUserImageCount(
                userImages.UserId.ToString(),
                userImages.UserName ?? "Unknown",
                userImages.ImageCount
            );
        }

        // Update per-user post counts
        var postsByUser = await dbContext.Posts
            .GroupBy(p => new { p.UserId, p.User.Name })
            .Select(g => new
            {
                UserId = g.Key.UserId,
                UserName = g.Key.Name,
                PostCount = g.Count()
            })
            .ToListAsync(cancellationToken);

        // Set per-user post metrics
        foreach (var userPosts in postsByUser)
        {
            metricsService.SetUserPostCount(
                userPosts.UserId.ToString(),
                userPosts.UserName ?? "Unknown",
                userPosts.PostCount
            );
        }

        // Update per-user comment counts
        var commentsByUser = await dbContext.Comments
            .GroupBy(c => new { c.UserId, c.User.Name })
            .Select(g => new
            {
                UserId = g.Key.UserId,
                UserName = g.Key.Name,
                CommentCount = g.Count()
            })
            .ToListAsync(cancellationToken);

        // Set per-user comment metrics
        foreach (var userComments in commentsByUser)
        {
            metricsService.SetUserCommentCount(
                userComments.UserId.ToString(),
                userComments.UserName ?? "Unknown",
                userComments.CommentCount
            );
        }

        // Calculate DAU/WAU/MAU from user activities
        var now = DateTime.UtcNow;
        var oneDayAgo = now.AddDays(-1);
        var sevenDaysAgo = now.AddDays(-7);
        var thirtyDaysAgo = now.AddDays(-30);

        var dailyActiveUsers = await dbContext.UserActivities
            .Where(a => a.ActivityDate >= oneDayAgo)
            .Select(a => a.UserId)
            .Distinct()
            .CountAsync(cancellationToken);

        var weeklyActiveUsers = await dbContext.UserActivities
            .Where(a => a.ActivityDate >= sevenDaysAgo)
            .Select(a => a.UserId)
            .Distinct()
            .CountAsync(cancellationToken);

        var monthlyActiveUsers = await dbContext.UserActivities
            .Where(a => a.ActivityDate >= thirtyDaysAgo)
            .Select(a => a.UserId)
            .Distinct()
            .CountAsync(cancellationToken);

        metricsService.SetDailyActiveUsers(dailyActiveUsers);
        metricsService.SetWeeklyActiveUsers(weeklyActiveUsers);
        metricsService.SetMonthlyActiveUsers(monthlyActiveUsers);

        _logger.LogDebug(
            "Updated metrics: Users={UserCount}, Posts={PostCount}, Images={ImageCount}, Comments={CommentCount}, " +
            "UsersWithImages={UsersWithImages}, UsersWithPosts={UsersWithPosts}, UsersWithComments={UsersWithComments}, " +
            "DAU={DAU}, WAU={WAU}, MAU={MAU}",
            userCount, postCount, imageCount, commentCount,
            imagesByUser.Count, postsByUser.Count, commentsByUser.Count,
            dailyActiveUsers, weeklyActiveUsers, monthlyActiveUsers);
    }
}
