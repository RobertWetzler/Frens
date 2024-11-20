using Cliq.Server.Models;
using Microsoft.EntityFrameworkCore;
using static System.Runtime.InteropServices.JavaScript.JSType;

namespace Cliq.Server.Data;

public class CliqDbContext : DbContext
{
    private readonly IHostEnvironment _env;
    public DbSet<Post> Posts { get; set; }
    public DbSet<User> Users { get; set; }

    public CliqDbContext(
            DbContextOptions<CliqDbContext> options,
            IHostEnvironment env) : base(options)
    {
        _env = env;
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        // Configure many-to-many relationship between Post and User (viewers)
        modelBuilder.Entity<Post>()
            .HasMany(p => p.Viewers)
            .WithMany();

        // Configure one-to-many relationship between User and Post
        modelBuilder.Entity<Post>()
            .HasOne(p => p.User)
            .WithMany()
            .HasForeignKey(p => p.UserId)
            .IsRequired();

        if (_env.IsDevelopment())
        {
            // Seed Users
            var users = new List<User>
            {
                new User {
                    Id = "user1",
                    Name = "John Doe",
                    Email = "john@example.com",
                    Password = BCrypt.Net.BCrypt.HashPassword("password123"),
                    Username = "johndoe"
                },
                new User {
                    Id = "user2",
                    Name = "Jane Smith",
                    Email = "jane@example.com",
                    Password = BCrypt.Net.BCrypt.HashPassword("password123"),
                    Username = "janesmith"
                },
                new User {
                    Id = "user3",
                    Name = "Bob Wilson",
                    Email = "bob@example.com",
                    Password = BCrypt.Net.BCrypt.HashPassword("password123"),
                    Username = "bobwilson"
                }
            };

            modelBuilder.Entity<User>().HasData(users);

            // Seed Posts
            var posts = new List<Post>
            {
                new Post {
                    Id = "post1",
                    UserId = "user1",
                    Date = DateTime.UtcNow.AddDays(-1),
                    Text = "Hello world! This is my first post."
                },
                new Post {
                    Id = "post2",
                    UserId = "user2",
                    Date = DateTime.UtcNow.AddHours(-12),
                    Text = "Excited to join this platform!"
                },
                new Post {
                    Id = "post3",
                    UserId = "user1",
                    Date = DateTime.UtcNow.AddHours(-6),
                    Text = "Another day, another post. #coding"
                }
            };

            modelBuilder.Entity<Post>().HasData(posts);

            // Seed Viewers (requires separate statements due to many-to-many relationship)
            modelBuilder.Entity("PostUser").HasData(
                new { ViewersId = "user2", PostId = "post1" },
                new { ViewersId = "user3", PostId = "post1" },
                new { ViewersId = "user1", PostId = "post2" },
                new { ViewersId = "user3", PostId = "post2" }
            );
        }
    }
}
