using Cliq.Server.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;

namespace Cliq.Server.Data;

public class CliqDbContext : IdentityDbContext<User>
{
    private readonly IHostEnvironment _env;
    public DbSet<Post> Posts { get; set; }
    public DbSet<Comment> Comments { get; set; }
    public DbSet<Friendship> Friendships { get; set; }

    public CliqDbContext(
            DbContextOptions<CliqDbContext> options,
            IHostEnvironment env) : base(options)
    {
        _env = env;
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Call base.OnModelCreating first to set up Identity tables
        base.OnModelCreating(modelBuilder);

        // At the top of OnModelCreating, before other configurations:
        modelBuilder.HasDefaultSchema("public");
        // Make Postgres use quoted identifiers for case-sensitivity
        modelBuilder.UseIdentityByDefaultColumns();

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

        modelBuilder.Entity<Comment>(entity =>
        {
            // Comment to User relationship
            entity.HasOne(c => c.User)
            .WithMany()
            .HasForeignKey(c => c.UserId)
            .IsRequired();

            // Comment to Post relationship (for top-level comments)
            entity.HasOne(c => c.Post)
                .WithMany(p => p.Comments)
                .HasForeignKey(c => c.PostId)
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();


            entity.HasOne(c => c.ParentComment)
                .WithMany(c => c.Replies)
                .HasForeignKey(c => c.ParentCommentId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Friendship>(entity =>
        {
            entity.HasKey(f => f.Id);

            // Relationship from Requester to Friendship
            entity.HasOne(f => f.Requester)
                .WithMany(u => u.FriendRequestsSent)
                .HasForeignKey(f => f.RequesterId)
                .OnDelete(DeleteBehavior.Restrict);

            // Relationship from Addressee to Friendship
            entity.HasOne(f => f.Addressee)
                .WithMany(u => u.FriendRequestsReceived)
                .HasForeignKey(f => f.AddresseeId)
                .OnDelete(DeleteBehavior.Restrict);

            // Create a unique constraint to prevent duplicate friendships
            entity.HasIndex(f => new { f.RequesterId, f.AddresseeId }).IsUnique();
        });

        if (_env.IsDevelopment())
        {
            // Seed Users
            var users = new List<User>
            {
                new User("sandman@example.com") {
                    Name = "Spencer Sands",
                },
                new User("smushi@example.com") {
                    Name = "Sierra Takushi",
                },
                new User("daddio@example.com") {
                    Name = "Howard Wetzler",
                },
                new User("devio@example.com") {
                    Name = "Devon Brandt",
                }
            };

            modelBuilder.Entity<User>().HasData(users);


            // Seed Posts
            var posts = new List<Post>
            {
                new Post {
                    Id = "seedPost1",
                    UserId = users[0].Id,
                    Date = DateTime.UtcNow.AddDays(-1),
                    Text = "Hello world! This is my first post."
                },
                new Post {
                    Id = "seedPost2",
                    UserId = users[1].Id,
                    Date = DateTime.UtcNow.AddHours(-12),
                    Text = "Excited to join this platform!"
                },
                new Post {
                    Id = "seedPost3",
                    UserId = users[2].Id,
                    Date = DateTime.UtcNow.AddHours(-6),
                    Text = "Another day, another post. #coding"
                }
            };
            modelBuilder.Entity<Post>().HasData(posts);
            // Seed Comments
            var comments = new List<Comment>
            {
                new Comment
                {
                    Id = "seedComment1",
                    UserId = users[2].Id,
                    Date = DateTime.UtcNow,
                    PostId = posts[0].Id,
                    Text = "I am bob and I am commenting on a post",
                },
                new Comment
                {
                    Id = "seedChildComment1_1",
                    UserId = users[0].Id,
                    Date = DateTime.UtcNow,
                    PostId = posts[0].Id,
                    ParentCommentId = "seedComment1",
                    Text = "I am John responding to Bob"
                },
                new Comment
                {
                    Id = "seedChildComment1_2",
                    UserId = users[3].Id,
                    Date = DateTime.UtcNow,
                    PostId = posts[0].Id,
                    ParentCommentId = "seedComment1",
                    Text = "I am DEVON and I AM SO COOL"
                },
                new Comment
                {
                    Id = "seedChildComment1_2_1",
                    UserId = users[3].Id,
                    Date = DateTime.UtcNow,
                    PostId = posts[0].Id,
                    ParentCommentId = "seedChildComment1_2",
                    Text = "Wassup devon this is devon"
                },
                new Comment
                {
                    Id = "seedChildComment1_1_1",
                    UserId = users[1].Id,
                    Date = DateTime.UtcNow,
                    PostId = posts[0].Id,
                    ParentCommentId = "seedChildComment1_1",
                    Text = "I am Jane responding to Bob"
                },
                new Comment
                {
                    Id = "seedComment2",
                    UserId = users[1].Id,
                    Date = DateTime.UtcNow,
                    PostId = posts[0].Id,
                    Text = "I am Jane and I am commenting on John's post"
                }
            };

            modelBuilder.Entity<Comment>().HasData(comments);

            // Seed Viewers (requires separate statements due to many-to-many relationship)
            // TODO THIS IS WRONG FOR SPECIFYING VIEWERS
            /*
            modelBuilder.Entity("PostUser").HasData(
                new { ViewersId = "seedUser2", PostId = "seedPost1" },
                new { ViewersId = "seedUser3", PostId = "seedPost1" },
                new { ViewersId = "seedUser1", PostId = "seedPost2" },
                new { ViewersId = "seedUser3", PostId = "seedPost2" }
            );
            */
        }
    }
}
