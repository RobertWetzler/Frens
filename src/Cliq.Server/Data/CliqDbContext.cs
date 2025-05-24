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
    public DbSet<Circle> Circles { get; set; }
    public DbSet<CircleMembership> CircleMemberships { get; set; }
    public DbSet<CirclePost> CirclePosts { get; set; }

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

        // Circles
        modelBuilder.Entity<Circle>()
            .HasMany(c => c.Members)
            .WithOne(m => m.Circle)
            .HasForeignKey(m => m.CircleId);

        modelBuilder.Entity<Circle>()
            .HasMany(c => c.Posts)
            .WithOne(cp => cp.Circle)
            .HasForeignKey(cp => cp.CircleId);

        // For querying user.OwnedCircles
        modelBuilder.Entity<Circle>()
            .HasOne(c => c.Owner)
            .WithMany(u => u.OwnedCircles)
            .HasForeignKey(c => c.OwnerId);

        modelBuilder.Entity<CircleMembership>()
            .HasKey(cm => new { cm.CircleId, cm.UserId });

        modelBuilder.Entity<CircleMembership>()
            .HasIndex(cm => cm.UserId); // For reverse lookup (User's circles)

        modelBuilder.Entity<CircleMembership>()
            .HasIndex(cm => cm.CircleId); // For reverse lookup (Users in a circle)

        modelBuilder.Entity<CircleMembership>()
            .HasIndex(cm => new { cm.CircleId, cm.UserId })
            .IsUnique();

        modelBuilder.Entity<CirclePost>()
            .HasKey(cp => new { cp.CircleId, cp.PostId });

        modelBuilder.Entity<CirclePost>()
            .HasIndex(cp => cp.CircleId); // For getting all posts per circle

        modelBuilder.Entity<CirclePost>()
            .HasIndex(cp => cp.PostId);   // For reverse joins if needed

        modelBuilder.Entity<Post>()
            .HasMany(p => p.SharedWithCircles)
            .WithOne(cp => cp.Post)
            .HasForeignKey(cp => cp.PostId);

        modelBuilder.Entity<Post>()
            .HasIndex(p => p.UserId);     // For querying all posts by a user

        modelBuilder.Entity<Circle>()
            .HasIndex(c => c.OwnerId);    // For admin tools
    }
}
