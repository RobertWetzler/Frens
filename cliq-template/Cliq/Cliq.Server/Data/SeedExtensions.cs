
using Cliq.Server.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Internal;

namespace Cliq.Server.Data;

public static class SeedExtensions
{
    public static void AddPosts(this ModelBuilder modelBuilder, List<User> users)
    {
        var sierra = modelBuilder.GetOrAddUser("smushi@example.com", "Sierra Takushi", users);
        var robert = modelBuilder.GetOrAddUser("robert@gmail.com", "Robert Wetzler", users);
        var spencer = modelBuilder.GetOrAddUser("sandman@example.com", "Spencer Sands", users);
        var devon = modelBuilder.GetOrAddUser("devio@example.com", "Devon Brandt", users);
        var jacob = modelBuilder.GetOrAddUser("twilly@example.com", "Jacob Terwilleger", users);
        var howard = modelBuilder.GetOrAddUser("daddio@example.com", "Howard Wetzler", users);

        var climbingCircle = modelBuilder.CreateCircle("Climbing Crew", false, robert, devon, spencer);
        var hikingCircle = modelBuilder.CreateCircle("Hiking Buddies", true, robert, sierra, jacob);
        var familyCircle = modelBuilder.CreateCircle("Family", false, robert, howard);

        var post1 = modelBuilder.CreatePost(robert, "Planning a climbing trip this weekend!", DateTime.UtcNow.AddHours(-10), climbingCircle);
        var post2 = modelBuilder.CreatePost(robert, "New hiking trail opened up — let's go!", DateTime.UtcNow.AddHours(-8), hikingCircle, climbingCircle);
        modelBuilder.CreatePost(sierra, "Anyone want to go for a hike Sunday?", DateTime.UtcNow.AddHours(-2), hikingCircle);
        modelBuilder.CreatePost(howard, "Letting family know: I’ll be out mountaineering Sunday.", DateTime.UtcNow.AddHours(-5), familyCircle);

        modelBuilder.AddCommentTree(post1, new[]
        {
            new C(devon, "Sick where should we go climb",
                new C(robert, "Lets go to Red Rock",
                    new C(devon, "Oh hell yea plus some cheeky vegas gambling eh?",
                        new C(spencer, "I’m in!"),
                        new C(robert, "I’m down for some gambling too!"),
                        new C(devon, "I’ll bring the cards")
                    )
                ),
                new C(robert, "Or Vantage")
            ),
            new C(spencer, "This will be so hype!!!!!")
        });
    }

    private static User GetOrAddUser(this ModelBuilder modelBuilder, string email, string name, List<User> users)
    {
        var passwordHasher = new Microsoft.AspNetCore.Identity.PasswordHasher<User>();
        var user = users.FirstOrDefault(u => u.Email == email);
        if (user == null)
        {
            user = new User(email)
            {
                Name = name,
                PasswordHash = passwordHasher.HashPassword(null!, "password")
            };
            users.Add(user);
            modelBuilder.Entity<User>().HasData(user);
        }
        return user;
    }
    private static Post CreatePost(this ModelBuilder modelBuilder, User author, string text, DateTime date, params Circle[] circles)
    {
        var post = new Post
        {
            Id = Guid.NewGuid(),
            UserId = author.Id,
            Text = text,
            Date = date
        };
        modelBuilder.Entity<Post>().HasData(post);

        foreach (var circle in circles)
        {
            var cp = new CirclePost
            {
                CircleId = circle.Id,
                PostId = post.Id,
                SharedAt = date
            };
            modelBuilder.Entity<CirclePost>().HasData(cp);
        }

        return post;
    }
    private static Circle CreateCircle(this ModelBuilder modelBuilder, string name, bool isShared, User owner, params User[] members)
    {
        var circle = new Circle
        {
            Id = Guid.NewGuid(),
            Name = name,
            IsShared = isShared,
            OwnerId = owner.Id
        };
        modelBuilder.Entity<Circle>().HasData(circle);

        foreach (var member in members.Append(owner).Distinct())
        {
            var membership = new CircleMembership
            {
                CircleId = circle.Id,
                UserId = member.Id
            };
            modelBuilder.Entity<CircleMembership>().HasData(membership);
        }

        return circle;
    }

    record C(User U, string T, params C[] Replies);

    private static void AddCommentTree(this ModelBuilder modelBuilder, Post post, IEnumerable<C> comments, Guid? parentId = null)
    {
        foreach (var c in comments)
        {
            var commentId = Guid.NewGuid();
            modelBuilder.Entity<Comment>().HasData(new Comment
            {
                Id = commentId,
                UserId = c.U.Id,
                Text = c.T,
                Date = DateTime.UtcNow,
                PostId = post.Id,
                ParentCommentId = parentId
            });

            if (c.Replies?.Length > 0)
                modelBuilder.AddCommentTree(post, c.Replies, commentId);
        }
    }
}