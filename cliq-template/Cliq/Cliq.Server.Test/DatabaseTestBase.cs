using Cliq.Server.Data;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting.Internal;
using Microsoft.Extensions.Hosting;

public abstract class DatabaseTestBase : IAsyncLifetime
{
    protected readonly string ConnectionString;
    protected readonly IHostEnvironment Environment;
    protected IDbContextTransaction? _transaction;
    protected CliqDbContext? Context;

    protected DatabaseTestBase()
    {
        ConnectionString = System.Environment.GetEnvironmentVariable("TEST_DATABASE_CONNECTION_STRING")
            ?? "Host=localhost;Database=cliq_test;Username=postgres;Password=postgres;Port=5433";
        Environment = new HostingEnvironment { EnvironmentName = "Testing" };
        
        // First ensure the database exists
        EnsureDatabaseCreated();
        
        // Create context for tests
        Context = CreateContext();
    }
    
    private void EnsureDatabaseCreated()
    {
        var options = new DbContextOptionsBuilder<CliqDbContext>()
            .UseNpgsql(ConnectionString)
            .Options;
        
        using var context = new CliqDbContext(options, Environment);
        context.Database.EnsureCreated();
    }

    protected CliqDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<CliqDbContext>()
            .UseNpgsql(ConnectionString)
            .Options;

        return new CliqDbContext(options, Environment);
    }

    // Runs before each test
    public async Task InitializeAsync()
    {
        // Start transaction
        _transaction = await Context.Database.BeginTransactionAsync();

        // Setup test data
        await SetupTestDataAsync(Context);
        await Context.SaveChangesAsync();
    }
    
    // Runs after each test
    public async Task DisposeAsync()
    {
        if (_transaction != null)
        {
            await _transaction.RollbackAsync();
            await _transaction.DisposeAsync();
        }
        
        if (Context != null)
        {
            await Context.DisposeAsync();
        }
    }

    protected abstract Task SetupTestDataAsync(CliqDbContext context);
}