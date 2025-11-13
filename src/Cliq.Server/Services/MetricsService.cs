using Prometheus;

namespace Cliq.Server.Services;

/// <summary>
/// Service to manage custom application metrics for Fly.io monitoring
/// </summary>
public class MetricsService
{
    // Counter for posts created
    private readonly Counter _postsCreatedCounter;
    
    // Counter for home feed loads
    private readonly Counter _homeFeedLoadsCounter;
    
    // Gauge for total number of users on the platform
    private readonly Gauge _totalUsersGauge;
    
    // Gauge for total number of posts on the platform
    private readonly Gauge _totalPostsGauge;
    
    // Gauge for total number of images posted on the platform
    private readonly Gauge _totalImagesGauge;
    
    // Gauge for images per user (labeled by user_id and user_name)
    private readonly Gauge _imagesPerUserGauge;
    
    // Gauge for posts per user (labeled by user_id and user_name)
    private readonly Gauge _postsPerUserGauge;
    
    // Gauge for total number of comments on the platform
    private readonly Gauge _totalCommentsGauge;
    
    // Gauge for comments per user (labeled by user_id and user_name)
    private readonly Gauge _commentsPerUserGauge;
    
    // Gauges for active users
    private readonly Gauge _dailyActiveUsersGauge;
    private readonly Gauge _weeklyActiveUsersGauge;
    private readonly Gauge _monthlyActiveUsersGauge;

    public MetricsService()
    {
        // Initialize custom metrics
        _postsCreatedCounter = Metrics.CreateCounter(
            "cliq_posts_created_total",
            "Total number of posts created in the application"
        );

        _homeFeedLoadsCounter = Metrics.CreateCounter(
            "cliq_homefeed_loads_total",
            "Total number of home feed loads"
        );

        _totalUsersGauge = Metrics.CreateGauge(
            "cliq_total_users",
            "Total number of registered users on the platform"
        );

        _totalPostsGauge = Metrics.CreateGauge(
            "cliq_total_posts",
            "Total number of posts on the platform"
        );

        _totalImagesGauge = Metrics.CreateGauge(
            "cliq_total_images",
            "Total number of images posted on the platform"
        );

        _imagesPerUserGauge = Metrics.CreateGauge(
            "cliq_images_per_user",
            "Number of images posted per user",
            new GaugeConfiguration
            {
                LabelNames = new[] { "user_id", "user_name" }
            }
        );

        _postsPerUserGauge = Metrics.CreateGauge(
            "cliq_posts_per_user",
            "Number of posts created per user",
            new GaugeConfiguration
            {
                LabelNames = new[] { "user_id", "user_name" }
            }
        );

        _totalCommentsGauge = Metrics.CreateGauge(
            "cliq_total_comments",
            "Total number of comments on the platform"
        );

        _commentsPerUserGauge = Metrics.CreateGauge(
            "cliq_comments_per_user",
            "Number of comments created per user",
            new GaugeConfiguration
            {
                LabelNames = new[] { "user_id", "user_name" }
            }
        );

        _dailyActiveUsersGauge = Metrics.CreateGauge(
            "cliq_daily_active_users",
            "Number of users active in the last 24 hours (posted, commented, or loaded feed)"
        );

        _weeklyActiveUsersGauge = Metrics.CreateGauge(
            "cliq_weekly_active_users",
            "Number of users active in the last 7 days (posted, commented, or loaded feed)"
        );

        _monthlyActiveUsersGauge = Metrics.CreateGauge(
            "cliq_monthly_active_users",
            "Number of users active in the last 30 days (posted, commented, or loaded feed)"
        );
    }

    /// <summary>
    /// Increment the post created counter
    /// </summary>
    public void IncrementPostsCreated()
    {
        _postsCreatedCounter.Inc();
    }

    /// <summary>
    /// Increment the home feed loads counter
    /// </summary>
    public void IncrementHomeFeedLoads()
    {
        _homeFeedLoadsCounter.Inc();
    }

    /// <summary>
    /// Update the total users gauge with the current count
    /// </summary>
    public void SetTotalUsers(int count)
    {
        _totalUsersGauge.Set(count);
    }

    /// <summary>
    /// Update the total posts gauge with the current count
    /// </summary>
    public void SetTotalPosts(int count)
    {
        _totalPostsGauge.Set(count);
    }

    /// <summary>
    /// Update the total images gauge with the current count
    /// </summary>
    public void SetTotalImages(int count)
    {
        _totalImagesGauge.Set(count);
    }

    /// <summary>
    /// Update image count for a specific user
    /// </summary>
    public void SetUserImageCount(string userId, string userName, int count)
    {
        _imagesPerUserGauge.WithLabels(userId, userName).Set(count);
    }

    /// <summary>
    /// Update post count for a specific user
    /// </summary>
    public void SetUserPostCount(string userId, string userName, int count)
    {
        _postsPerUserGauge.WithLabels(userId, userName).Set(count);
    }

    /// <summary>
    /// Update the total comments gauge with the current count
    /// </summary>
    public void SetTotalComments(int count)
    {
        _totalCommentsGauge.Set(count);
    }

    /// <summary>
    /// Update comment count for a specific user
    /// </summary>
    public void SetUserCommentCount(string userId, string userName, int count)
    {
        _commentsPerUserGauge.WithLabels(userId, userName).Set(count);
    }

    /// <summary>
    /// Update daily active users count
    /// </summary>
    public void SetDailyActiveUsers(int count)
    {
        _dailyActiveUsersGauge.Set(count);
    }

    /// <summary>
    /// Update weekly active users count
    /// </summary>
    public void SetWeeklyActiveUsers(int count)
    {
        _weeklyActiveUsersGauge.Set(count);
    }

    /// <summary>
    /// Update monthly active users count
    /// </summary>
    public void SetMonthlyActiveUsers(int count)
    {
        _monthlyActiveUsersGauge.Set(count);
    }
}
