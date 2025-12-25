# Architecture Improvements Plan

## Current State Analysis

The codebase is reasonably well-structured but has some areas that slow down development:

- **PostService is 945 lines with 11 dependencies** — hard to modify safely
- **DTOs mixed with domain models** — tight coupling in `/Models`
- **Repeated auth boilerplate** — `AuthUtils.TryGetUserIdFromToken()` in every action
- **Notification side effects mixed with business logic** — hard to extend
- **Fire-and-forget tasks** — can silently fail

---

## Quick Wins (Do Now)

### 1. Create `ApiControllerBase`

Eliminates 50+ lines of repeated auth boilerplate across controllers.

```csharp
public abstract class ApiControllerBase : ControllerBase
{
    protected Guid UserId => 
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    
    protected bool TryGetUserId(out Guid userId)
    {
        var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(claim, out userId);
    }
}
```

**Effort:** 5 minutes  
**Impact:** High — cleaner controllers, less repetition

### 2. Move DTOs to `/DTOs` Folder

Separate data transfer objects from domain entities:

```
/Models     → EF entities only (Post, Circle, Comment, etc.)
/DTOs       → PostDto, CircleDto, UserDto, etc.
```

**Effort:** 30 minutes  
**Impact:** Medium — cleaner separation of concerns

---

## Phase 1: Service Layer Cleanup

### 3. Split Large Services

Break `PostService` (945 lines, 11 deps) into focused services:

| New Service | Responsibility | Dependencies |
|-------------|----------------|--------------|
| `FeedService` | GetFeed, GetFilteredFeed | DbContext, Mapper |
| `PostCreationService` | CreatePost, CreateEvent | DbContext, Storage, Notifications |
| `PostQueryService` | GetPost, GetPostsForCircle | DbContext, Mapper |

**Effort:** 2-3 hours  
**Impact:** High — easier to test, modify, and understand

### 4. Extract Authorization Logic

Create dedicated authorization services instead of inline checks:

```csharp
public interface IPostAuthorizationService
{
    Task<bool> CanViewAsync(Guid userId, Guid postId);
    Task<bool> CanEditAsync(Guid userId, Guid postId);
    Task<bool> CanDeleteAsync(Guid userId, Guid postId);
}
```

**Effort:** 1-2 hours  
**Impact:** Medium — reusable auth logic, easier testing

---

## Phase 2: Side Effect Decoupling

### 5. Implement Simple Domain Events

Decouple notifications and activity tracking from core business logic:

```csharp
public interface IEventBus
{
    Task PublishAsync<T>(T @event) where T : class;
}

public class SimpleEventBus : IEventBus
{
    private readonly IServiceProvider _services;
    
    public SimpleEventBus(IServiceProvider services) => _services = services;
    
    public async Task PublishAsync<T>(T @event) where T : class
    {
        var handlers = _services.GetServices<IEventHandler<T>>();
        foreach (var handler in handlers)
        {
            await handler.HandleAsync(@event);
        }
    }
}

public interface IEventHandler<T>
{
    Task HandleAsync(T @event);
}
```

Example events:
- `CommentCreatedEvent` → triggers notification + activity tracking
- `PostCreatedEvent` → triggers notifications to circle members
- `UserJoinedCircleEvent` → triggers welcome notification

**Effort:** 2-3 hours  
**Impact:** High — add new side effects without touching core services

### 6. Replace Fire-and-Forget with Background Queue

Current problematic pattern:
```csharp
_ = Task.Run(async () => await _activityService.RecordActivityAsync(...));
```

Replace with a proper background queue:

```csharp
public interface IBackgroundTaskQueue
{
    ValueTask QueueAsync(Func<IServiceProvider, CancellationToken, Task> workItem);
}
```

**Effort:** 1 hour  
**Impact:** Medium — reliable background processing, proper error handling

---

## Phase 3: Optional Enhancements

### 7. FluentValidation for Request Validation

Replace manual validation with declarative rules:

```csharp
public class CreatePostValidator : AbstractValidator<CreatePostRequest>
{
    public CreatePostValidator()
    {
        RuleFor(x => x.Text).NotEmpty().MaximumLength(4000);
        RuleFor(x => x.CircleIds).NotEmpty()
            .When(x => x.UserIds == null || !x.UserIds.Any());
    }
}
```

**Effort:** 2-3 hours  
**Impact:** Medium — cleaner validation, better error messages

### 8. Result Pattern for Service Responses

Instead of throwing exceptions for business logic errors:

```csharp
public class Result<T>
{
    public T? Value { get; }
    public string? Error { get; }
    public bool IsSuccess => Error == null;
    
    public static Result<T> Success(T value) => new(value, null);
    public static Result<T> Failure(string error) => new(default, error);
}
```

**Effort:** 1-2 hours  
**Impact:** Low-Medium — explicit error handling, no exception overhead

---

## NOT Recommended (For Now)

| Pattern | Reason to Skip |
|---------|----------------|
| MediatR + Full CQRS | Overkill for 1-2 devs; adds boilerplate without proportional benefit |
| Vertical Slice folder restructure | Disruptive; only worth it if navigation is painful |
| Microservices split | Premature; monolith is fine until you have scaling issues |

---

## EF Core Optimizations (Performance)

### Use Projections Instead of Full Entity Loading

```csharp
// Instead of: .Include(p => p.User).Include(p => p.Comments)
var posts = await _dbContext.Posts
    .Where(...)
    .Select(p => new PostDto
    {
        Id = p.Id,
        Text = p.Text,
        CommentCount = p.Comments.Count,
        // Only fetch what you need
    })
    .ToListAsync();
```

### Add Compiled Queries for Hot Paths

```csharp
public static readonly Func<CliqDbContext, Guid, IAsyncEnumerable<Guid>> GetUserCircleIds =
    EF.CompileAsyncQuery((CliqDbContext db, Guid userId) =>
        db.CircleMemberships
            .Where(cm => cm.UserId == userId)
            .Select(cm => cm.CircleId));
```

---

## Recommended Project Structure (Target)

```
/src/Cliq.Server
├── /Common
│   ├── Result.cs
│   ├── ApiControllerBase.cs
│   └── /Events (SimpleEventBus, IEventHandler)
├── /DTOs
│   ├── PostDto.cs
│   ├── CircleDto.cs
│   └── ...
├── /Models (EF entities only)
├── /Services
│   ├── /Posts
│   │   ├── FeedService.cs
│   │   ├── PostCreationService.cs
│   │   └── PostQueryService.cs
│   ├── /Circles
│   ├── /Comments
│   └── ...
├── /Authorization
├── /Controllers
├── /Data
└── Program.cs
```

---

## Summary Priority Matrix

| Task | Effort | Impact | Priority |
|------|--------|--------|----------|
| ApiControllerBase | 5 min | High | ✅ Now |
| Move DTOs to folder | 30 min | Medium | ✅ Now |
| Split PostService | 2-3 hrs | High | 🔜 Soon |
| Simple domain events | 2-3 hrs | High | 🔜 Soon |
| Authorization services | 1-2 hrs | Medium | 🔜 Soon |
| Background queue | 1 hr | Medium | 🔜 Soon |
| FluentValidation | 2-3 hrs | Medium | ⏸️ Later |
| Result pattern | 1-2 hrs | Low-Med | ⏸️ Later |
| EF projections | Ongoing | High (perf) | ⏸️ As needed |
