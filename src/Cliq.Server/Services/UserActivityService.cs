using Cliq.Server.Data;
using Cliq.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace Cliq.Server.Services;

/// <summary>
/// Service to track and record user activity for metrics
/// </summary>
public class UserActivityService : IUserActivityService
{
    private readonly CliqDbContext _dbContext;
    private readonly ILogger<UserActivityService> _logger;

    public UserActivityService(CliqDbContext dbContext, ILogger<UserActivityService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    /// <summary>
    /// Record a user activity (async, fire-and-forget style to not block main flow)
    /// </summary>
    public async Task RecordActivityAsync(Guid userId, UserActivityType activityType)
    {
        try
        {
            var activity = new UserActivity
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                ActivityDate = DateTime.UtcNow,
                ActivityType = activityType
            };

            await _dbContext.UserActivities.AddAsync(activity);
            await _dbContext.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            // Don't throw - activity tracking shouldn't break the main flow
            _logger.LogWarning(ex, "Failed to record user activity for user {UserId}, type {ActivityType}", 
                userId, activityType);
        }
    }

    /// <summary>
    /// Delete activity records older than 30 days to keep table size manageable
    /// </summary>
    public async Task CleanupOldActivitiesAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var cutoffDate = DateTime.UtcNow.AddDays(-30);
            var deleted = await _dbContext.UserActivities
                .Where(a => a.ActivityDate < cutoffDate)
                .ExecuteDeleteAsync(cancellationToken);

            if (deleted > 0)
            {
                _logger.LogInformation("Cleaned up {Count} old user activity records (older than 30 days)", deleted);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to cleanup old user activities");
        }
    }
}
