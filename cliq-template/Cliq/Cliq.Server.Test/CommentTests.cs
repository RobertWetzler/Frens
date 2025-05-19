using AutoMapper;
using Cliq.Server.Data;
using Cliq.Server.Models;
using Cliq.Server.Utilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

public class CommentTests : DatabaseTestBase
{
    private Guid _postId;
    private Guid _userId;
    private Comment _comment1;
    private Comment _comment2;
    private Comment _subComment;
    private Comment _subComment2;

    private ICommentService _commentService;

    private IMapper _mapper;
    public CommentTests() : base()
    {
        // Initialize stateless members that are the same for all tests, dont depend on test data
        _mapper = CliqMappingHelper.CreateMapper();
    }
    protected override async Task SetupTestDataAsync(CliqDbContext context)
    {
        // Create minimal data needed for this specific test
        var user = new User
        {
            Name = "Test User",
            Email = "test@example.com",
            UserName = "testuser"
        };

        var post = new Post
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Date = DateTime.UtcNow,
            Text = "Test post"
        };

        var comment1 = new Comment
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            PostId = post.Id,
            Date = DateTime.UtcNow,
            Text = "Test comment 1"
        };

        var comment2 = new Comment
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            PostId = post.Id,
            Date = DateTime.UtcNow,
            Text = "Test comment 2"
        };

        var subComment = new Comment
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            PostId = post.Id,
            ParentCommentId = comment2.Id,
            Date = DateTime.UtcNow,
            Text = "Reply to comment 2"
        };

        var subComment2 = new Comment
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            PostId = post.Id,
            ParentCommentId = subComment.Id,
            Date = DateTime.UtcNow,
            Text = "Reply to subcomment"
        };

        await context.Users.AddAsync(user);
        await context.Posts.AddAsync(post);
        await context.Comments.AddRangeAsync(comment1, comment2, subComment, subComment2);

        _postId = post.Id;
        _userId = user.Id;
        _comment1 = comment1;
        _comment2 = comment2;
        _subComment = subComment;
        _subComment2 = subComment2;
        _commentService = new CommentService(context, _mapper);
    }

    #region Data querying tests
    [Fact]
    public async Task CanGetTopLevelComments_FromQuery()
    {
        // Use the shared context that already has the transaction
        var comments = await Context.Comments
            .Where(c => c.PostId == _postId)
            .Where(c => c.ParentCommentId == null)
            .Include(c => c.User)
            .ToListAsync();

        Assert.Equal(2, comments.Count);
        Assert.All(comments, c => Assert.Equal(_postId, c.PostId));
        Assert.All(comments, c => Assert.Null(c.ParentCommentId));
    }

    [Fact]
    public async Task CanGetCommentWithReplies_FromQuery()
    {
        // Arrange
        var parentCommentId = _comment2.Id;

        // Act
        var comment = await Context.Comments
            .Include(c => c.Replies)
            .FirstOrDefaultAsync(c => c.Id == parentCommentId);

        // Assert
        Assert.NotNull(comment);
        Assert.Single(comment.Replies);
        Assert.Equal("Reply to comment 2", comment.Replies.First().Text);
    }
    #endregion
    #region Service tests
    [Fact]
    public async Task CanGetAllComments_FromService()
    {
        // Act
        var comments = (await _commentService.GetAllCommentsForPostAsync(_postId)).ToList();

        // Assert
        Assert.Equal(2, comments.Count); // Two top-level comments

        var comment2 = comments.FirstOrDefault(c => c.Id == _comment2.Id);
        Assert.NotNull(comment2);
        Assert.Single(comment2.Replies);
        var actualSubComment = comment2.Replies.First(); // First level of replies is present
        Assert.Equal(_subComment.Id, actualSubComment.Id);
        var actualSubComment2 = actualSubComment.Replies.First(); // Second level of replies is present
        Assert.Equal(_subComment2.Id, actualSubComment2.Id);
    }
    #endregion
}