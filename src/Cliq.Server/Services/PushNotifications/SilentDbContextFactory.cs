using Cliq.Server.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Cliq.Server.Services.PushNotifications;

/// <summary>
/// Factory for creating DbContext instances with suppressed logging for high-frequency operations
/// </summary>
public interface ISilentDbContextFactory
{
    CliqDbContext CreateContext();
}

public class SilentDbContextFactory : ISilentDbContextFactory
{
    private readonly IServiceProvider _serviceProvider;
    private readonly DbContextOptions<CliqDbContext> _silentOptions;
    
    public SilentDbContextFactory(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
        
        // Create DbContext options with suppressed EF command logging
        var optionsBuilder = new DbContextOptionsBuilder<CliqDbContext>();
        
        // Get the connection string from the main DbContext configuration
        using var scope = serviceProvider.CreateScope();
        var mainContext = scope.ServiceProvider.GetRequiredService<CliqDbContext>();
        var connectionString = mainContext.Database.GetConnectionString();
        
        optionsBuilder.UseNpgsql(connectionString)
                     .UseLoggerFactory(LoggerFactory.Create(builder => 
                         builder.AddFilter("Microsoft.EntityFrameworkCore.Database.Command", LogLevel.None)));
        
        _silentOptions = optionsBuilder.Options;
    }
    
    public CliqDbContext CreateContext()
    {
        var environment = _serviceProvider.GetRequiredService<IWebHostEnvironment>();
        return new CliqDbContext(_silentOptions, environment);
    }
}
