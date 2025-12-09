using Cliq.Server.Models;

namespace Cliq.Server.Services;

/// <summary>
/// Service interface to track and record user activity for metrics
/// </summary>
public interface IUserActivityService
{
    /// <summary>
    /// Record a user activity
    /// </summary>
    Task RecordActivityAsync(Guid userId, UserActivityType activityType);
    
    /// <summary>
    /// Delete activity records older than 30 days to keep table size manageable
    /// </summary>
    Task CleanupOldActivitiesAsync(CancellationToken cancellationToken = default);
}
