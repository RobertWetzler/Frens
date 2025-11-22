using Cliq.Server.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using System.Text.Json;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

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
    public DbSet<IndividualPost> IndividualPosts { get; set; }
    public DbSet<EfPushSubscription> PushSubscriptions { get; set; }
    public DbSet<Notification> Notifications { get; set; }
    public DbSet<NotificationDelivery> NotificationDeliveries { get; set; }
    public DbSet<EventRsvp> EventRsvps { get; set; }
    public DbSet<CalendarSubscription> CalendarSubscription { get; set; }
    public DbSet<UserActivity> UserActivities { get; set; }

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
            .Property(c => c.IsSubscribable)
            .HasDefaultValue(false)
            .IsRequired();

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

        modelBuilder.Entity<IndividualPost>()
            .HasKey(ip => new { ip.UserId, ip.PostId });

        modelBuilder.Entity<IndividualPost>()
            .HasIndex(ip => ip.UserId); // For getting all individual posts per user

        modelBuilder.Entity<IndividualPost>()
            .HasIndex(ip => ip.PostId);   // For reverse joins if needed

        modelBuilder.Entity<Post>()
            .HasMany(p => p.SharedWithCircles)
            .WithOne(cp => cp.Post)
            .HasForeignKey(cp => cp.PostId);

        modelBuilder.Entity<Post>()
            .HasMany(p => p.SharedWithUsers)
            .WithOne(ip => ip.Post)
            .HasForeignKey(ip => ip.PostId);

        modelBuilder.Entity<Post>()
            .HasIndex(p => p.UserId);     // For querying all posts by a user

        // Store ordered list of image object keys as jsonb (serialized list) without requiring Npgsql dynamic JSON
        var imagesConverter = new ValueConverter<List<string>, string>(
            v => JsonSerializer.Serialize(v ?? new List<string>(), new JsonSerializerOptions()),
            v => string.IsNullOrWhiteSpace(v) ? new List<string>() : (JsonSerializer.Deserialize<List<string>>(v, new JsonSerializerOptions()) ?? new List<string>()));

        var imagesComparer = new ValueComparer<List<string>>(
            (l1, l2) => (l1 ?? new List<string>()).SequenceEqual(l2 ?? new List<string>()),
            l => (l ?? new List<string>()).Aggregate(0, (a, v) => HashCode.Combine(a, v.GetHashCode())),
            l => (l ?? new List<string>()).ToList());

        modelBuilder.Entity<Post>()
            .Property(p => p.ImageObjectKeys)
            .HasConversion(imagesConverter)
            .Metadata.SetValueComparer(imagesComparer);
        modelBuilder.Entity<Post>()
            .Property(p => p.ImageObjectKeys)
            .HasColumnName("image_object_keys")
            .HasColumnType("jsonb");

        modelBuilder.Entity<Circle>()
            .HasIndex(c => c.OwnerId);    // For admin tools

        // NOTIFICATIONS
        // ========== EfPushSubscription ==========
        modelBuilder.Entity<EfPushSubscription>(entity =>
        {
            entity.HasKey(p => p.Id);

            entity.Property(p => p.Endpoint).IsRequired();
            entity.Property(p => p.P256DH).IsRequired();
            entity.Property(p => p.Auth).IsRequired();
            entity.Property(p => p.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.HasIndex(p => p.Endpoint).IsUnique();
            entity.HasIndex(p => p.UserId); // For querying subscriptions by user
            entity
                .HasOne(p => p.User)
                .WithMany(u => u.PushSubscriptions) // or .WithMany(u => u.PushSubscriptions) if you're adding reverse nav
                .HasForeignKey(p => p.UserId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ========== Notification ==========
        modelBuilder.Entity<Notification>(entity =>
        {
            entity.HasKey(n => n.Id);

            entity.Property(n => n.Id)
                  .HasColumnName("id")
                  .HasDefaultValueSql("gen_random_uuid()");

            entity.Property(n => n.UserId)
                  .HasColumnName("user_id")
                  .IsRequired();

            entity.Property(n => n.Title)
                    .HasColumnName("title")
                    .IsRequired();

            entity.Property(n => n.Message)
                  .HasColumnName("message")
                  .IsRequired();

            entity.Property(n => n.AppBadge)
                  .HasColumnName("app_badge");

            entity.Property(n => n.Navigate)
                  .HasColumnName("navigate");

            entity.Property(n => n.Metadata)
                  .HasColumnName("metadata")
                  .HasColumnType("jsonb");

            entity.Property(n => n.CreatedAt)
                  .HasColumnName("created_at")
                  .HasDefaultValueSql("NOW()")
                  .IsRequired();

            entity.HasMany(n => n.Deliveries)
                  .WithOne(d => d.Notification)
                  .HasForeignKey(d => d.NotificationId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ========== NotificationDelivery ==========
        modelBuilder.Entity<NotificationDelivery>(entity =>
        {
            entity.ToTable("notification_delivery");

            entity.HasKey(d => d.Id);

            entity.Property(d => d.Id)
                  .HasColumnName("id")
                  .HasDefaultValueSql("gen_random_uuid()");

            entity.Property(d => d.NotificationId)
                  .HasColumnName("notification_id")
                  .IsRequired();

            entity.Property(d => d.SubscriptionId)
                  .HasColumnName("subscription_id")
                  .IsRequired();

            entity.Property(d => d.PushSubscriptionEndpoint)
                  .HasColumnName("push_subscription_endpoint");

            entity.Property(d => d.Status)
                  .HasColumnName("status")
                  .HasDefaultValue("pending")
                  .IsRequired();

            entity.Property(d => d.Retries)
                  .HasColumnName("retries")
                  .HasDefaultValue(0)
                  .IsRequired();

            entity.Property(d => d.CreatedAt)
                  .HasColumnName("created_at")
                  .HasDefaultValueSql("NOW()")
                  .IsRequired();

            entity.Property(d => d.LockedBy)
                  .HasColumnName("locked_by");

            entity.Property(d => d.LockedUntil)
                  .HasColumnName("locked_until");

            entity.HasOne(d => d.Subscription)
                  .WithMany()
                  .HasForeignKey(d => d.SubscriptionId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // ========== Event (Inheritance) ==========
        // Configure Table Per Hierarchy inheritance
        modelBuilder.Entity<Post>()
            .HasDiscriminator<string>("PostType")
            .HasValue<Post>("Post")
            .HasValue<Post>("") // Handle existing posts with empty discriminator
            .HasValue<Event>("Event");

        // Event-specific configuration
        modelBuilder.Entity<Event>()
            .Property(e => e.Title)
            .IsRequired()
            .HasMaxLength(500);

        modelBuilder.Entity<Event>()
            .Property(e => e.Location)
            .HasMaxLength(500);

        modelBuilder.Entity<Event>()
            .Property(e => e.Timezone)
            .HasMaxLength(50)
            .HasDefaultValue("UTC");

        modelBuilder.Entity<Event>()
            .Property(e => e.RecurrenceRule)
            .HasMaxLength(1000);

        modelBuilder.Entity<Event>()
            .HasMany(e => e.Rsvps)
            .WithOne(r => r.Event)
            .HasForeignKey(r => r.EventId)
            .OnDelete(DeleteBehavior.Cascade);

        // ========== EventRsvp ==========
        modelBuilder.Entity<EventRsvp>(entity =>
        {
            entity.HasKey(r => r.Id);

            entity.Property(r => r.Status)
                  .IsRequired();

            entity.Property(r => r.ResponseDate)
                  .HasDefaultValueSql("NOW()");

            entity.Property(r => r.Notes)
                  .HasMaxLength(1000);

            entity.HasOne(r => r.User)
                  .WithMany()
                  .HasForeignKey(r => r.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            // Unique constraint: one RSVP per user per event
            entity.HasIndex(r => new { r.EventId, r.UserId })
                  .IsUnique();
        });

        modelBuilder.Entity<CalendarSubscription>(entity =>
        {
            entity.HasKey(c => c.Id);
            entity.Property(c => c.UserId).IsRequired();
            entity.Property(c => c.CreatedAt).HasDefaultValueSql("NOW()");

            entity.HasIndex(c => c.UserId).IsUnique();
            entity.HasOne<User>()
                  .WithMany()
                  .HasForeignKey(c => c.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // UserActivity configuration for DAU/WAU/MAU metrics
        modelBuilder.Entity<UserActivity>(entity =>
        {
            entity.HasKey(a => a.Id);
            entity.Property(a => a.UserId).IsRequired();
            entity.Property(a => a.ActivityDate).IsRequired();
            entity.Property(a => a.ActivityType).IsRequired();

            // Index for efficient querying by user and date
            entity.HasIndex(a => new { a.UserId, a.ActivityDate });
            // Index for querying by date (for cleanup and DAU/WAU/MAU calculations)
            entity.HasIndex(a => a.ActivityDate);

            entity.HasOne(a => a.User)
                  .WithMany()
                  .HasForeignKey(a => a.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
