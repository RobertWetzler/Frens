using Cliq.Server.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;

namespace Cliq.Server.Data;

public class CliqDbContext : IdentityDbContext<User, CliqRole, Guid>
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
                    Bio = "Your life is your's to create."
                },
                new User("smushi@example.com") {
                    Name = "Sierra Takushi",
                    Email = "smushi@example.com",
                    NormalizedEmail = "SMUSHI@EXAMPLE.COM",
                    NormalizedUserName = "SMUSHI@EXAMPLE.COM",
                    EmailConfirmed = true,
                    SecurityStamp = Guid.NewGuid().ToString()
                },
                new User("daddio@example.com") {
                    Name = "Howard Wetzler",
                },
                new User("devio@example.com") {
                    Name = "Devon Brandt",
                    Bio = "Life is like a game of chess. I don't know how to play chess.",
                },
                new User("twilly@example.com") {
                    Name = "Jacob Terwilleger",
                    Bio = "Just chill out everybody.",
                }
            };
            // Hash passwords for seeded users
            var passwordHasher = new PasswordHasher<User>();
            foreach (var user in users)
            {
                user.PasswordHash = passwordHasher.HashPassword(user, "password");
            }
            modelBuilder.Entity<User>().HasData(users);


            // Seed Posts
            var posts = new List<Post>
            {
                new Post {
                    Id = Guid.NewGuid(),
                    UserId = users[0].Id,
                    Date = DateTime.UtcNow.AddDays(-1),
                    Text = "Hello world! This is my first post."
                },
                new Post {
                    Id = Guid.NewGuid(),
                    UserId = users[1].Id,
                    Date = DateTime.UtcNow.AddHours(-12),
                    Text = "Excited to join this platform!"
                },
                new Post {
                    Id = Guid.NewGuid(),
                    UserId = users[2].Id,
                    Date = DateTime.UtcNow.AddHours(-6),
                    Text = "Another day, another post. #coding"
                },
                new Post {
                    Id = Guid.NewGuid(),
                    UserId = users[4].Id,
                    Date = DateTime.UtcNow.AddHours(-1),
                    Text = "Just finished a great workout! Feeling good."
                }
            };
            modelBuilder.Entity<Post>().HasData(posts);
            // Seed Comments
            var comments = new List<Comment>
            {
                new Comment
                {
                    Id = new Guid("11111111-1111-1111-1111-111111111111"), // Defining a fixed GUID for the first comment
                    UserId = users[2].Id,
                    Date = DateTime.UtcNow,
                    PostId = posts[0].Id,
                    Text = "I am bob and I am commenting on a post",
                },
                new Comment
                {
                    Id = new Guid("22222222-2222-2222-2222-222222222222"),
                    UserId = users[0].Id,
                    Date = DateTime.UtcNow,
                    PostId = posts[0].Id,
                    ParentCommentId = new Guid("11111111-1111-1111-1111-111111111111"), // Reference to first comment
                    Text = "I am John responding to Bob"
                },
                new Comment
                {
                    Id = new Guid("33333333-3333-3333-3333-333333333333"),
                    UserId = users[3].Id,
                    Date = DateTime.UtcNow,
                    PostId = posts[0].Id,
                    ParentCommentId = new Guid("11111111-1111-1111-1111-111111111111"), // Reference to first comment
                    Text = "I am DEVON and I AM SO COOL"
                },
                new Comment
                {
                    Id = new Guid("44444444-4444-4444-4444-444444444444"),
                    UserId = users[3].Id,
                    Date = DateTime.UtcNow,
                    PostId = posts[0].Id,
                    ParentCommentId = new Guid("33333333-3333-3333-3333-333333333333"), // Reference to Devon's comment
                    Text = "Wassup devon this is devon"
                },
                new Comment
                {
                    Id = new Guid("55555555-5555-5555-5555-555555555555"),
                    UserId = users[1].Id,
                    Date = DateTime.UtcNow,
                    PostId = posts[0].Id,
                    ParentCommentId = new Guid("22222222-2222-2222-2222-222222222222"), // Changed to reference John's comment
                    Text = "I am Jane responding to Bob"
                },
                new Comment
                {
                    Id = new Guid("66666666-6666-6666-6666-666666666666"),
                    UserId = users[1].Id,
                    Date = DateTime.UtcNow,
                    PostId = posts[0].Id,
                    Text = "I am Jane and I am commenting on John's post"
                },
                new Comment
                {
                    Id = new Guid("77777777-7777-7777-7777-777777777777"),
                    UserId = users[3].Id,
                    Date = DateTime.UtcNow,
                    PostId = posts[3].Id,
                    Text = "I am DEVON and I AM SO COOL. Wanna play Minecraft? I have a diamond sword named Excalibur.",
                },
                new Comment
                {
                    Id = new Guid("88888888-8888-8888-8888-888888888888"),
                    ParentCommentId = new Guid("77777777-7777-7777-7777-777777777777"), // Reference to Devon's Minecraft comment
                    UserId = users[4].Id,
                    Date = DateTime.UtcNow,
                    PostId = posts[3].Id,
                    Text = "Im down. I have a diamond sword too. Wanna have a duel?",
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
