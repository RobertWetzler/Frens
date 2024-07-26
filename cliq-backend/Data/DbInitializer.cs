namespace CliqBackend.Data;

using CliqBackend.Models;
using System;
using System.Diagnostics;
using System.Linq;

public static class DbInitializer
{
    public static void Initialize(ApplicationDbContext context)
    {
        context.Database.EnsureCreated();

        // Look for any Users.
        if (context.Users.Any())
        {
            return;   // DB has been seeded
        }

        var robert = new User { Name = "Robert Testzler", Id = "1" };
        var users = new User[]
        {
            robert,
            new User{Name="Spencer Tsands", Id="2"},
            new User{Name="Liam Taloney", Id="3"},
            new User{Name="Aimee Tandridge", Id="4"},
            new User{Name="Jake Towe", Id="5"},

        };
        foreach (User s in users)
        {
            context.Users.Add(s);
        }
        context.SaveChanges();

        var posts = new Post[]
        {
            new Post{Id="1", Date=new DateTime(2024,1,2),Text="Awesome Saucome post",User=robert, UserId=robert.Id}
        };

        foreach (Post post in posts)
        {
            context.Posts.Add(post);
        }
        context.SaveChanges();
    }
}
