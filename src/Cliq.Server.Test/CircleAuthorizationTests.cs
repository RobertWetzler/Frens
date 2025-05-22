using Cliq.Server.Data;
using Cliq.Server.Models;
using Cliq.Server.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Xunit;

public class CircleAuthorizationTests : DatabaseTestBase
{
    private Guid _ownerId;
    private Guid _memberId;
    private Guid _nonMemberId;
    private Guid _sharedCircleId;
    private Guid _privateCircleId;
    private Guid _emptyCircleId;
    private Guid _nonExistentCircleId;

    public CircleAuthorizationTests() : base()
    {
        _nonExistentCircleId = Guid.NewGuid();
    }

    protected override async Task SetupTestDataAsync(CliqDbContext context)
    {
        // Create test users
        var owner = new User("owner@example.com")
        {
            Id = Guid.NewGuid(),
            Name = "Circle Owner"
        };

        var member = new User("member@example.com")
        {
            Id = Guid.NewGuid(),
            Name = "Circle Member"
        };

        var nonMember = new User("nonmember@example.com")
        {
            Id = Guid.NewGuid(),
            Name = "Non Member"
        };

        // Create test circles
        var sharedCircle = new Circle
        {
            Id = Guid.NewGuid(),
            Name = "Shared Circle",
            IsShared = true,
            OwnerId = owner.Id
        };

        var privateCircle = new Circle
        {
            Id = Guid.NewGuid(),
            Name = "Private Circle",
            IsShared = false,
            OwnerId = owner.Id
        };

        var emptyCircle = new Circle
        {
            Id = Guid.NewGuid(),
            Name = "Empty Circle",
            IsShared = true,
            OwnerId = owner.Id
        };

        // Create circle memberships
        var sharedCircleMembership = new CircleMembership
        {
            CircleId = sharedCircle.Id,
            UserId = member.Id
        };

        var privateCircleMembership = new CircleMembership
        {
            CircleId = privateCircle.Id,
            UserId = member.Id
        };

        // Add entities to context
        await context.Users.AddRangeAsync(owner, member, nonMember);
        await context.Circles.AddRangeAsync(sharedCircle, privateCircle, emptyCircle);
        await context.CircleMemberships.AddRangeAsync(sharedCircleMembership, privateCircleMembership);

        // Store IDs for tests
        _ownerId = owner.Id;
        _memberId = member.Id;
        _nonMemberId = nonMember.Id;
        _sharedCircleId = sharedCircle.Id;
        _privateCircleId = privateCircle.Id;
        _emptyCircleId = emptyCircle.Id;
    }

    [Fact]
    public async Task Owner_CanPost_ToOwnedCircle()
    {
        // Arrange
        var circleIds = new[] { _sharedCircleId };

        // Act & Assert - Should not throw exception
        await CircleService.ValidateAuthorizationToPostAsync(Context, circleIds, _ownerId);
    }

    [Fact]
    public async Task Member_CanPost_ToSharedCircle()
    {
        // Arrange
        var circleIds = new[] { _sharedCircleId };

        // Act & Assert - Should not throw exception
        await CircleService.ValidateAuthorizationToPostAsync(Context, circleIds, _memberId);
    }

    [Fact]
    public async Task NonMember_CannotPost_ToAnyCircle()
    {
        // Arrange
        var circleIds = new[] { _sharedCircleId };

        // Act & Assert
        var exception = await Assert.ThrowsAsync<UnauthorizedAccessException>(
            async () => await CircleService.ValidateAuthorizationToPostAsync(Context, circleIds, _nonMemberId)
        );

        Assert.Contains(_sharedCircleId.ToString(), exception.Message);
    }

    [Fact]
    public async Task Multiple_Circles_AreValidated_Correctly()
    {
        // Arrange - Owner should be able to post to all their circles
        var circleIds = new[] { _sharedCircleId, _privateCircleId, _emptyCircleId };

        // Act & Assert - Should not throw exception
        await CircleService.ValidateAuthorizationToPostAsync(Context, circleIds, _ownerId);
    }

    [Fact]
    public async Task NonExistentCircle_ThrowsException()
    {
        // Arrange
        var circleIds = new[] { _nonExistentCircleId };

        // Act & Assert
        var exception = await Assert.ThrowsAsync<BadHttpRequestException>(
            async () => await CircleService.ValidateAuthorizationToPostAsync(Context, circleIds, _ownerId)
        );

        Assert.Contains(_nonExistentCircleId.ToString(), exception.Message);
    }

    [Fact]
    public async Task MixedValid_And_Invalid_Circles_ThrowsException()
    {
        // Arrange
        var circleIds = new[] { _sharedCircleId, _nonExistentCircleId };

        // Act & Assert
        var exception = await Assert.ThrowsAsync<BadHttpRequestException>(
            async () => await CircleService.ValidateAuthorizationToPostAsync(Context, circleIds, _ownerId)
        );

        Assert.Contains(_nonExistentCircleId.ToString(), exception.Message);
        Assert.DoesNotContain(_sharedCircleId.ToString(), exception.Message);
    }

    [Fact]
    public async Task Member_OfSome_But_NotAll_Circles_ThrowsException()
    {
        // Arrange
        var circleIds = new[] { _sharedCircleId, _emptyCircleId };

        // Act & Assert
        var exception = await Assert.ThrowsAsync<UnauthorizedAccessException>(
            async () => await CircleService.ValidateAuthorizationToPostAsync(Context, circleIds, _memberId)
        );

        Assert.Contains(_emptyCircleId.ToString(), exception.Message);
        Assert.DoesNotContain(_sharedCircleId.ToString(), exception.Message);
    }

    [Fact]
    public async Task Empty_CircleIdList_DoesNotThrow()
    {
        // Arrange
        var circleIds = Array.Empty<Guid>();

        // Act & Assert - Should not throw exception
        await CircleService.ValidateAuthorizationToPostAsync(Context, circleIds, _ownerId);
    }
}