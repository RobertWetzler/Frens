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
            ?? "Host=localhost;Database=cliq_test;Username=postgres;Password=postgres";
        Environment = new HostingEnvironment { EnvironmentName = "Testing" };
        // Use a shared context throughought the test lifecycle
        // Otherwise there is issues sharing transaction across different DbContext instances
        Context = CreateContext();
        Context.Database.EnsureDeleted();
        Context.Database.EnsureCreated();
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
        await Context.Database.BeginTransactionAsync();

        // Setup test data
        await SetupTestDataAsync(Context);
        await Context.SaveChangesAsync();
    }
    
    // Runs after each test
    public async Task DisposeAsync()
    {
        if (Context.Database.CurrentTransaction != null)
        {
            await Context.Database.RollbackTransactionAsync();
        }
        await Context.DisposeAsync();
    }

    protected abstract Task SetupTestDataAsync(CliqDbContext context);
}