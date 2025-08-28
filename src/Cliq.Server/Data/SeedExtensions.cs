using Cliq.Server.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Cliq.Server.Data;

public static class SeedExtensions
{
    public static async Task SeedDevelopmentDataAsync(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CliqDbContext>();
        
        // Check if data already exists to avoid duplicates
        if (await db.Users.AnyAsync()) return;

        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<User>>();

        // Create users first
        var users = await CreateUsersAsync(userManager);
        
        // Create additional users not in the initial list
        var additionalUsers = await CreateAdditionalUsersAsync(userManager);
        users.AddRange(additionalUsers);

        // Now add other data using the DbContext
        await AddPostsAndRelatedDataAsync(db, users);
    }

    private static async Task<List<User>> CreateUsersAsync(UserManager<User> userManager)
    {
        var users = new List<User>
        {
            new User("sandman@example.com") {
                Name = "Spencer Sands",
                Email = "sandman@example.com",
                Bio = "Your life is your's to create."
            },
            new User("smushi@example.com") {
                Name = "Sierra Takushi",
                Email = "smushi@example.com",
                EmailConfirmed = true
            },
            new User("daddio@example.com") {
                Email = "daddio@example.com",
                Name = "Howard Wetzler"
            },
            new User("robert@gmail.com") {
                Email = "robert@gmail.com",
                Name = "Robert Wetzler",
                EmailConfirmed = true
            },
            new User("devio@example.com") {
                Name = "Devon Brandt",
                Email = "devio@example.com",
                Bio = "Life is like a game of chess. I don't know how to play chess."
            },
            new User("twilly@example.com") {
                Name = "Jacob Terwilleger",
                Email = "twilly@example.com",
                Bio = "Just chill out everybody."
            }
        };

        // Create users with UserManager for proper password hashing
        foreach (var user in users)
        {
            await userManager.CreateAsync(user, "TestPassword123!");
        }

        return users;
    }

    private static async Task<List<User>> CreateAdditionalUsersAsync(UserManager<User> userManager)
    {
        var additionalUsers = new List<User>
        {
            new User("carolyn@example.com") { Name = "Carolyn Wetzler", Email = "carolyn@example.com" },
            new User("anya@example.com") { Name = "Anya Steinberg", Email = "anya@example.com" },
            new User("kevin@example.com") { Name = "Kevin Jones", Email = "kevin@example.com" },
            new User("mira@example.com") { Name = "Mira Peterson", Email = "mira@example.com" },
            new User("eliza@example.com") { Name = "Eliza Topolosky", Email = "eliza@example.com" },
            new User("lauren@example.com") { Name = "Lauren Topolosky", Email = "lauren@example.com" },
            new User("barbara@example.com") { Name = "Barbara Topolosky", Email = "barbara@example.com" },
            new User("elana@example.com") { Name = "Elana Loomis", Email = "elana@example.com" },
            new User("daltin@example.com") { Name = "Daltin Loomis", Email = "daltin@example.com" }
        };

        foreach (var user in additionalUsers)
        {
            await userManager.CreateAsync(user, "TestPassword123!");
        }

        return additionalUsers;
    }

    private static async Task AddPostsAndRelatedDataAsync(CliqDbContext db, List<User> users)
    {
        var sierra = GetUser(users, "smushi@example.com");
        var robert = GetUser(users, "robert@gmail.com");
        var spencer = GetUser(users, "sandman@example.com");
        var devon = GetUser(users, "devio@example.com");
        var jacob = GetUser(users, "twilly@example.com");
        var howard = GetUser(users, "daddio@example.com");
        var carolyn = GetUser(users, "carolyn@example.com");
        var anya = GetUser(users, "anya@example.com");
        var kevin = GetUser(users, "kevin@example.com");
        var mira = GetUser(users, "mira@example.com");
        var eliza = GetUser(users, "eliza@example.com");
        var lauren = GetUser(users, "lauren@example.com");
        var barbara = GetUser(users, "barbara@example.com");
        var elana = GetUser(users, "elana@example.com");
        var daltin = GetUser(users, "daltin@example.com");

        // Add friendships
        await AddFriendshipsAsync(db, robert, new[] { sierra, spencer, devon, jacob, howard, carolyn, eliza, lauren, barbara, elana, daltin });
        await AddFriendshipsAsync(db, sierra, new[] { anya, kevin, mira });
        await AddFriendshipsAsync(db, spencer, new[] { devon, sierra });
        await AddFriendshipsAsync(db, devon, new[] { jacob });

        // Add some outstanding friend requests
        await AddFriendshipsAsync(db, robert, [anya, kevin, mira], FriendshipStatus.Pending);

        // Create circles
        var climbingCircle = await CreateCircleAsync(db, "Climbing Crew", false, robert, new[] { devon, spencer });
        var hikingCircle = await CreateCircleAsync(db, "Hiking Buddies", true, robert, new[] { sierra, jacob });
        await CreateCircleAsync(db, "Hiking Buddies", true, robert, new[] { sierra, jacob });
        await CreateCircleAsync(db, "Hiking Buddies", true, robert, new[] { sierra, jacob });
        await CreateCircleAsync(db, "Hiking Buddies", true, robert, new[] { sierra, jacob });
        await CreateCircleAsync(db, "Hiking Buddies", true, robert, new[] { sierra, jacob });
        await CreateCircleAsync(db, "Hiking Buddies", true, robert, new[] { sierra, jacob });
        var familyCircle = await CreateCircleAsync(db, "Family", false, robert, new[] { howard, elana, daltin, carolyn });
        var sierraFriends = await CreateCircleAsync(db, "Sierra's Friends", true, sierra, new[] { anya, kevin, mira, robert });

        // Create posts
        var post1 = await CreatePostAsync(db, robert, "Planning a climbing trip this weekend!", DateTime.UtcNow.AddHours(-10), new[] { climbingCircle });
        await CreatePostAsync(db, robert, "New hiking trail opened up — let's go!", DateTime.UtcNow.AddHours(-8), new[] { hikingCircle, climbingCircle });
        await CreatePostAsync(db, sierra, "Anyone want to go for a hike Sunday?", DateTime.UtcNow.AddHours(-2), new[] { hikingCircle, sierraFriends });
        await CreatePostAsync(db, howard, "Letting family know: I'll be out mountaineering Sunday.", DateTime.UtcNow.AddHours(-5), new[] { familyCircle });
        await CreatePostAsync(db, howard, "Letting family know: I'll be out mountaineering Sunday.", DateTime.UtcNow.AddHours(-5), new[] { familyCircle });
        await CreatePostAsync(db, howard, "Letting family know: I'll be out mountaineering Sunday.", DateTime.UtcNow.AddHours(-5), new[] { familyCircle });
        await CreatePostAsync(db, howard, "Letting family know: I'll be out mountaineering Sunday.", DateTime.UtcNow.AddHours(-5), new[] { familyCircle });
        await CreatePostAsync(db, howard, "Letting family know: I'll be out mountaineering Sunday.", DateTime.UtcNow.AddHours(-5), new[] { familyCircle });

        // Create events
        await CreateEventAsync(db, devon, "Climbing at Red Rock", "Climbing Trip", DateTime.UtcNow.AddDays(3).AddHours(9), DateTime.UtcNow.AddDays(3).AddHours(17), DateTime.UtcNow.AddHours(-1), new[] { climbingCircle });
        await CreateEventAsync(db, sierra, "Hiking at Mount Si", "Hiking Trip", DateTime.UtcNow.AddDays(5).AddHours(8), DateTime.UtcNow.AddDays(5).AddHours(14), DateTime.UtcNow.AddHours(-3), new[] { hikingCircle, sierraFriends });
        var picnicEvent = await CreateEventAsync(db, howard, "Family Picnic", "Picnic at the Park", DateTime.UtcNow.AddDays(7).AddHours(11), DateTime.UtcNow.AddDays(7).AddHours(15), DateTime.UtcNow.AddHours(-4), new[] { familyCircle });
        // Add comments
        await AddCommentTreeAsync(db, post1,
        [
            new C(devon, "Sick where should we go climb",
                new C(robert, "Lets go to Red Rock",
                    new C(devon, "Oh hell yea plus some cheeky vegas gambling eh?",
                        new C(spencer, "I'm in!"),
                        new C(robert, "I'm down for some gambling too!"),
                        new C(devon, "I'll bring the cards")
                    )
                ),
                new C(robert, "Or Vantage")
            ),
            new C(spencer, "This will be so hype!!!!!")
        ]);
        // add commments to some events
        await AddCommentTreeAsync(db, picnicEvent,
        [
            new C(carolyn, "Can't wait! Should I bring anything?",
                new C(robert, "Just bring yourself!")),
            new C(robert, "Looking forward to it!")
        ]);
    }

    private static User GetUser(List<User> users, string email)
    {
        return users.First(u => u.Email == email);
    }

    private static async Task AddFriendshipsAsync(CliqDbContext db, User user, User[] friends, FriendshipStatus status = FriendshipStatus.Accepted)
    {
        var friendships = friends.Select(friend => new Friendship
        {
            Id = Guid.NewGuid(),
            AddresseeId = user.Id,
            RequesterId = friend.Id,
            Status = status
        }).ToList();

        await db.Friendships.AddRangeAsync(friendships);
        await db.SaveChangesAsync();
    }

    private static async Task<Circle> CreateCircleAsync(CliqDbContext db, string name, bool isShared, User owner, User[] members)
    {
        var circle = new Circle
        {
            Id = Guid.NewGuid(),
            Name = name,
            IsShared = isShared,
            OwnerId = owner.Id
        };

        await db.Circles.AddAsync(circle);
        await db.SaveChangesAsync();

        var memberships = members.Append(owner).Distinct().Select(member => new CircleMembership
        {
            CircleId = circle.Id,
            UserId = member.Id
        }).ToList();

        await db.CircleMemberships.AddRangeAsync(memberships);
        await db.SaveChangesAsync();

        return circle;
    }

    private static async Task<Post> CreatePostAsync(CliqDbContext db, User author, string text, DateTime date, Circle[] circles)
    {
        var post = new Post
        {
            Id = Guid.NewGuid(),
            UserId = author.Id,
            Text = text,
            Date = date
        };

        await db.Posts.AddAsync(post);
        await db.SaveChangesAsync();

        var circlePosts = circles.Select(circle => new CirclePost
        {
            CircleId = circle.Id,
            PostId = post.Id,
            SharedAt = date
        }).ToList();

        await db.CirclePosts.AddRangeAsync(circlePosts);
        await db.SaveChangesAsync();

        return post;
    }

    private static async Task<Event> CreateEventAsync(CliqDbContext db, User author, string text, string title, DateTime startDateTime, DateTime endDateTime, DateTime sharedDate, Circle[] circles)
    {
        var @event = new Event
        {
            Id = Guid.NewGuid(),
            UserId = author.Id,
            Text = text,
            Title = title,
            StartDateTime = startDateTime,
            EndDateTime = endDateTime,
            Date = DateTime.UtcNow,
            Timezone = "PST"
        };

        await db.Posts.AddAsync(@event);
        await db.SaveChangesAsync();

        var circlePosts = circles.Select(circle => new CirclePost
        {
            CircleId = circle.Id,
            PostId = @event.Id,
            SharedAt = @event.Date
        }).ToList();

        await db.CirclePosts.AddRangeAsync(circlePosts);
        await db.SaveChangesAsync();

        return @event;
    }


    private record C(User U, string T, params C[] Replies);

    private static async Task AddCommentTreeAsync(CliqDbContext db, Post post, IEnumerable<C> comments, Guid? parentId = null)
    {
        foreach (var c in comments)
        {
            var commentId = Guid.NewGuid();
            var comment = new Comment
            {
                Id = commentId,
                UserId = c.U.Id,
                Text = c.T,
                Date = DateTime.UtcNow,
                PostId = post.Id,
                ParentCommentId = parentId
            };

            await db.Comments.AddAsync(comment);
            await db.SaveChangesAsync();

            if (c.Replies?.Length > 0)
                await AddCommentTreeAsync(db, post, c.Replies, commentId);
        }
    }
}