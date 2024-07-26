namespace CliqBackend.Data;

using CliqBackend.Models;
using Microsoft.EntityFrameworkCore;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<Post> Posts { get; set; }
    public DbSet<User> Users { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Post>().ToTable("Post");
        modelBuilder.Entity<User>().ToTable("User");
    }

    // Add DbSet properties for your entities here
    // public DbSet<YourEntity> YourEntities { get; set; }
}