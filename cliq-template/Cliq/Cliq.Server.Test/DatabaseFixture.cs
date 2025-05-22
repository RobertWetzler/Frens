using Cliq.Server.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Hosting.Internal;

namespace Cliq.Server.Test;
// Create a fixture for database setup
public class DatabaseFixture : IDisposable
{
    private readonly string _connectionString;
    private readonly IHostEnvironment _environment;

    public DatabaseFixture()
    {
        _connectionString = Environment.GetEnvironmentVariable("TEST_DATABASE_CONNECTION_STRING")
            ?? "Host=localhost;Database=cliq_test;Username=postgres;Password=postgres;Port=5433";
        _environment = new HostingEnvironment { EnvironmentName = "Testing" };

        // Ensure database exists
        EnsureDatabaseCreated();
    }

    private void EnsureDatabaseCreated()
    {
        var options = new DbContextOptionsBuilder<CliqDbContext>()
            .UseNpgsql(_connectionString)
            .Options;

        using var context = new CliqDbContext(options, _environment);
        context.Database.EnsureCreated();
    }

    public CliqDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<CliqDbContext>()
            .UseNpgsql(_connectionString)
            .Options;

        return new CliqDbContext(options, _environment);
    }

    public void Dispose()
    {
        // No need to clean up database - it will be reused between tests
    }
}

// Define a collection to prevent parallel execution
[CollectionDefinition("Database Tests")]
public class DatabaseCollection : ICollectionFixture<DatabaseFixture>
{
    // This class has no code, and is never created. Its purpose is simply
    // to be the place to apply [CollectionDefinition] and all the
    // ICollectionFixture<> interfaces.
}