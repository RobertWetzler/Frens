using AutoMapper;
using Cliq.Server.Data;
using Cliq.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace Cliq.Server.Services;

public interface IEventService
{
    Task<EventDto?> GetEventByIdAsync(Guid requestorId, Guid id, bool includeRsvps = true);
    Task<List<EventDto>> GetEventsForUserAsync(Guid userId, int page = 1, int pageSize = 20);
    Task<List<EventDto>> GetAllEventsForUserAsync(Guid userId);
    Task<List<EventDto>> GetUpcomingEventsAsync(Guid userId, int page = 1, int pageSize = 20);
    Task<EventDto> CreateEventAsync(Guid userId, CreateEventDto createEventDto);
    Task<EventDto?> UpdateEventAsync(Guid eventId, Guid updatedByUserId, UpdateEventDto updateEventDto);
    Task<bool> DeleteEventAsync(Guid eventId, Guid deletedByUserId);
    Task<EventRsvpDto?> RsvpToEventAsync(Guid eventId, Guid userId, CreateRsvpDto rsvpDto);
    Task<bool> RemoveRsvpAsync(Guid eventId, Guid userId);
    Task<List<EventRsvpDto>> GetEventRsvpsAsync(Guid eventId);
    Task<string> GenerateICalAsync(Guid eventId);
    Task<string> GenerateICalAsync(List<EventDto> events);
    Task<Guid> CreateICalSubscriptionAsync(Guid userId);
    Task<string> GenerateICalForSubscriptionAsync(Guid subscriptionId);
    Task<string?> GetICalSubscriptionUrlAsync(Guid userId);
}

public class EventService : IEventService
{
    private readonly CliqDbContext _dbContext;
    private readonly IMapper _mapper;
    private readonly IEventNotificationService _eventNotificationService;
    private readonly ILogger<EventService> _logger;

    public EventService(
        CliqDbContext dbContext,
        IMapper mapper,
        IEventNotificationService eventNotificationService,
        ILogger<EventService> logger)
    {
        _dbContext = dbContext;
        _mapper = mapper;
        _eventNotificationService = eventNotificationService;
        _logger = logger;
    }

    public async Task<EventDto?> GetEventByIdAsync(Guid requestorId, Guid id, bool includeRsvps = true)
    {
        var eventEntity = await _dbContext.Posts
            .OfType<Event>()
            .Include(e => e.User)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (eventEntity == null)
        {
            return null;
        }

        // Check authorization (same logic as posts)
        bool isAuthorized = eventEntity.UserId == requestorId;

        if (!isAuthorized)
        {
            isAuthorized = await _dbContext.CirclePosts
                .Where(cp => cp.PostId == id)
                .AnyAsync(cp => _dbContext.CircleMemberships
                    .Any(cm => cm.CircleId == cp.CircleId && cm.UserId == requestorId));

            if (!isAuthorized)
            {
                _logger.LogWarning("User {UserId} attempted unauthorized access to event {EventId}", requestorId, id);
                return null;
            }
        }

        var dto = _mapper.Map<EventDto>(eventEntity);

        if (includeRsvps)
        {
            var rsvps = await _dbContext.EventRsvps
                .Where(r => r.EventId == id)
                .Include(r => r.User)
                .ToListAsync();

            dto.Rsvps = _mapper.Map<List<EventRsvpDto>>(rsvps);
            dto.GoingCount = rsvps.Count(r => r.Status == RsvpStatus.Going);
            dto.MaybeCount = rsvps.Count(r => r.Status == RsvpStatus.Maybe);
            dto.NotGoingCount = rsvps.Count(r => r.Status == RsvpStatus.NotGoing);
            dto.CurrentUserRsvp = rsvps.FirstOrDefault(r => r.UserId == requestorId)?.Status;
        }

        return dto;
    }

    public async Task<List<EventDto>> GetEventsForUserAsync(Guid userId, int page = 1, int pageSize = 20)
    {
        var events = await _dbContext.Posts
            .OfType<Event>()
            .Where(e => e.SharedWithCircles.Any(cp =>
                _dbContext.CircleMemberships.Any(cm => cm.CircleId == cp.CircleId && cm.UserId == userId))
                || e.UserId == userId)
            .Include(e => e.User)
            .OrderByDescending(e => e.StartDateTime)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return _mapper.Map<List<EventDto>>(events);
    }

    public async Task<List<EventDto>> GetAllEventsForUserAsync(Guid userId)
    {
        var events = await _dbContext.Posts
            .OfType<Event>()
            .Where(e => e.SharedWithCircles.Any(cp =>
                _dbContext.CircleMemberships.Any(cm => cm.CircleId == cp.CircleId && cm.UserId == userId))
                || e.UserId == userId)
            .Include(e => e.User)
            .OrderByDescending(e => e.StartDateTime)
            .ToListAsync();

        return _mapper.Map<List<EventDto>>(events);
    }

    public async Task<List<EventDto>> GetUpcomingEventsAsync(Guid userId, int page = 1, int pageSize = 20)
    {
        var now = DateTime.UtcNow;
        var events = await _dbContext.Posts
            .OfType<Event>()
            .Where(e => e.StartDateTime > now &&
                (e.SharedWithCircles.Any(cp =>
                    _dbContext.CircleMemberships.Any(cm => cm.CircleId == cp.CircleId && cm.UserId == userId))
                || e.UserId == userId))
            .Include(e => e.User)
            .OrderBy(e => e.StartDateTime)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return _mapper.Map<List<EventDto>>(events);
    }

    public async Task<EventDto> CreateEventAsync(Guid userId, CreateEventDto createEventDto)
    {
        var user = await this._dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            throw new BadHttpRequestException($"Cannot create post for invalid user {userId}");
        }
        await CircleService.ValidateAuthorizationToPostAsync(_dbContext, createEventDto.CircleIds, userId);
        var eventEntity = new Event
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Date = DateTime.UtcNow,
            Text = createEventDto.Text,
            Title = createEventDto.Title,
            StartDateTime = createEventDto.StartDateTime,
            EndDateTime = createEventDto.EndDateTime,
            Location = createEventDto.Location,
            Timezone = createEventDto.Timezone ?? "UTC",
            MaxAttendees = createEventDto.MaxAttendees,
            IsAllDay = createEventDto.IsAllDay,
            IsRecurring = createEventDto.IsRecurring,
            RecurrenceRule = createEventDto.RecurrenceRule
        };

        _dbContext.Posts.Add(eventEntity);

        // Add circle associations
        foreach (var circleId in createEventDto.CircleIds)
        {
            _dbContext.CirclePosts.Add(new CirclePost
            {
                CircleId = circleId,
                PostId = eventEntity.Id
            });
        }

        await _dbContext.SaveChangesAsync();
        // Send notifications to circle members
        try
        {
            await _eventNotificationService.SendNewEventNotificationAsync(eventEntity.Id, userId, eventEntity.Title, createEventDto.CircleIds, user.Name);
        }
        catch (Exception ex)
        {
            // Log error but don't fail the post creation
            _logger.LogWarning(ex, "Failed to send post notifications for post {PostId}", eventEntity.Id);
        }
        // Reload the event with necessary includes for proper mapping
        var savedEvent = await _dbContext.Posts
            .OfType<Event>()
            .Include(e => e.User)
            .Include(e => e.SharedWithCircles)
                .ThenInclude(cp => cp.Circle)
            .FirstOrDefaultAsync(e => e.Id == eventEntity.Id);

        return _mapper.Map<EventDto>(savedEvent);
    }

    public async Task<EventDto?> UpdateEventAsync(Guid eventId, Guid updatedByUserId, UpdateEventDto updateEventDto)
    {
        var eventEntity = await _dbContext.Posts
            .OfType<Event>()
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (eventEntity == null || eventEntity.UserId != updatedByUserId)
        {
            return null;
        }

        // Update properties if provided
        if (updateEventDto.Title != null) eventEntity.Title = updateEventDto.Title;
        if (updateEventDto.Text != null) eventEntity.Text = updateEventDto.Text;
        if (updateEventDto.StartDateTime.HasValue) eventEntity.StartDateTime = updateEventDto.StartDateTime.Value;
        if (updateEventDto.EndDateTime.HasValue) eventEntity.EndDateTime = updateEventDto.EndDateTime;
        if (updateEventDto.Location != null) eventEntity.Location = updateEventDto.Location;
        if (updateEventDto.Timezone != null) eventEntity.Timezone = updateEventDto.Timezone;
        if (updateEventDto.MaxAttendees.HasValue) eventEntity.MaxAttendees = updateEventDto.MaxAttendees;
        if (updateEventDto.IsAllDay.HasValue) eventEntity.IsAllDay = updateEventDto.IsAllDay.Value;
        if (updateEventDto.IsRecurring.HasValue) eventEntity.IsRecurring = updateEventDto.IsRecurring.Value;
        if (updateEventDto.RecurrenceRule != null) eventEntity.RecurrenceRule = updateEventDto.RecurrenceRule;

        await _dbContext.SaveChangesAsync();

        return _mapper.Map<EventDto>(eventEntity);
    }

    public async Task<bool> DeleteEventAsync(Guid eventId, Guid deletedByUserId)
    {
        var eventEntity = await _dbContext.Posts
            .OfType<Event>()
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (eventEntity == null || eventEntity.UserId != deletedByUserId)
        {
            return false;
        }

        _dbContext.Posts.Remove(eventEntity);
        await _dbContext.SaveChangesAsync();

        return true;
    }

    public async Task<EventRsvpDto?> RsvpToEventAsync(Guid eventId, Guid userId, CreateRsvpDto rsvpDto)
    {
        // Check if event exists and user has access
        var hasAccess = await _dbContext.Posts
            .OfType<Event>()
            .Where(e => e.Id == eventId)
            .AnyAsync(e => e.SharedWithCircles.Any(cp =>
                _dbContext.CircleMemberships.Any(cm => cm.CircleId == cp.CircleId && cm.UserId == userId))
                || e.UserId == userId);

        if (!hasAccess)
        {
            return null;
        }

        // Check if RSVP already exists
        var existingRsvp = await _dbContext.EventRsvps
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.EventId == eventId && r.UserId == userId);

        if (existingRsvp != null)
        {
            // Update existing RSVP
            existingRsvp.Status = rsvpDto.Status;
            existingRsvp.Notes = rsvpDto.Notes;
            existingRsvp.ResponseDate = DateTime.UtcNow;
        }
        else
        {
            // Create new RSVP
            existingRsvp = new EventRsvp
            {
                Id = Guid.NewGuid(),
                EventId = eventId,
                UserId = userId,
                Status = rsvpDto.Status,
                Notes = rsvpDto.Notes,
                ResponseDate = DateTime.UtcNow
            };
            _dbContext.EventRsvps.Add(existingRsvp);
        }

        await _dbContext.SaveChangesAsync();

        // Reload with user info
        existingRsvp = await _dbContext.EventRsvps
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.Id == existingRsvp.Id);

        return _mapper.Map<EventRsvpDto>(existingRsvp);
    }

    public async Task<bool> RemoveRsvpAsync(Guid eventId, Guid userId)
    {
        var rsvp = await _dbContext.EventRsvps
            .FirstOrDefaultAsync(r => r.EventId == eventId && r.UserId == userId);

        if (rsvp == null)
        {
            return false;
        }

        _dbContext.EventRsvps.Remove(rsvp);
        await _dbContext.SaveChangesAsync();

        return true;
    }

    public async Task<List<EventRsvpDto>> GetEventRsvpsAsync(Guid eventId)
    {
        var rsvps = await _dbContext.EventRsvps
            .Where(r => r.EventId == eventId)
            .Include(r => r.User)
            .ToListAsync();

        return _mapper.Map<List<EventRsvpDto>>(rsvps);
    }

    public async Task<string> GenerateICalAsync(Guid eventId)
    {
        var eventEntity = await _dbContext.Posts
            .OfType<Event>()
            .Include(e => e.User)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (eventEntity == null)
        {
            throw new ArgumentException("Event not found", nameof(eventId));
        }

        // Generate iCal format
        var ical = new System.Text.StringBuilder();
        ical.AppendLine("BEGIN:VCALENDAR");
        ical.AppendLine("VERSION:2.0");
        ical.AppendLine("PRODID:-//Cliq//Event//EN");
        ical.AppendLine("BEGIN:VEVENT");
        ical.AppendLine($"UID:{eventEntity.Id}");
        ical.AppendLine($"DTSTAMP:{DateTime.UtcNow:yyyyMMddTHHmmssZ}");
        ical.AppendLine($"DTSTART:{eventEntity.StartDateTime:yyyyMMddTHHmmssZ}");

        if (eventEntity.EndDateTime.HasValue)
        {
            ical.AppendLine($"DTEND:{eventEntity.EndDateTime.Value:yyyyMMddTHHmmssZ}");
        }

        ical.AppendLine($"SUMMARY:{eventEntity.Title}");
        ical.AppendLine($"DESCRIPTION:{eventEntity.Text?.Replace("\n", "\\n")}");

        if (!string.IsNullOrEmpty(eventEntity.Location))
        {
            ical.AppendLine($"LOCATION:{eventEntity.Location}");
        }

        if (!string.IsNullOrEmpty(eventEntity.RecurrenceRule))
        {
            ical.AppendLine($"RRULE:{eventEntity.RecurrenceRule}");
        }

        ical.AppendLine($"ORGANIZER:CN={eventEntity.User.Name}");
        ical.AppendLine("END:VEVENT");
        ical.AppendLine("END:VCALENDAR");

        return ical.ToString();
    }

    public async Task<string> GenerateICalAsync(List<EventDto> events)
    {
        var ical = new System.Text.StringBuilder();
        ical.AppendLine("BEGIN:VCALENDAR");
        ical.AppendLine("VERSION:2.0");
        ical.AppendLine("PRODID:-//Cliq//Events//EN");

        foreach (var eventEntity in events)
        {
            ical.AppendLine("BEGIN:VEVENT");
            ical.AppendLine($"UID:{eventEntity.Id}");
            ical.AppendLine($"DTSTAMP:{DateTime.UtcNow:yyyyMMddTHHmmssZ}");
            ical.AppendLine($"DTSTART:{eventEntity.StartDateTime:yyyyMMddTHHmmssZ}");

            if (eventEntity.EndDateTime.HasValue)
            {
                ical.AppendLine($"DTEND:{eventEntity.EndDateTime.Value:yyyyMMddTHHmmssZ}");
            }

            ical.AppendLine($"SUMMARY:{eventEntity.Title}");
            ical.AppendLine($"DESCRIPTION:{eventEntity.Text?.Replace("\n", "\\n")}");

            if (!string.IsNullOrEmpty(eventEntity.Location))
            {
                ical.AppendLine($"LOCATION:{eventEntity.Location}");
            }

            if (!string.IsNullOrEmpty(eventEntity.RecurrenceRule))
            {
                ical.AppendLine($"RRULE:{eventEntity.RecurrenceRule}");
            }

            // Assuming we have access to the User's name in EventDto
            ical.AppendLine($"ORGANIZER:CN={eventEntity.User?.Name ?? "Unknown"}");
            ical.AppendLine("END:VEVENT");
        }

        ical.AppendLine("END:VCALENDAR");

        return ical.ToString();
    }


    public async Task<Guid> CreateICalSubscriptionAsync(Guid userId)
    {
        // Removing any existing subscriptions
        var currentSubscriptions = _dbContext.CalendarSubscription
                                    .Where(c => c.UserId == userId)
                                    .ToArray();

        _dbContext.RemoveRange(currentSubscriptions);

        // Create a new subscription
        var newSubscription = new CalendarSubscription
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.CalendarSubscription.Add(newSubscription);
        await _dbContext.SaveChangesAsync();

        return newSubscription.Id;
    }

    public async Task<string> GenerateICalForSubscriptionAsync(Guid subscriptionId)
    {
        var userId = _dbContext.CalendarSubscription
            .Where(c => c.Id == subscriptionId)
            .Select(c => c.UserId)
            .FirstOrDefault();

        if (userId == Guid.Empty)
        {
            throw new ArgumentException("Invalid subscription ID");
        }

        var events = await GetAllEventsForUserAsync(userId);
        
        return await GenerateICalAsync(events);
    }

    public async Task<string?> GetICalSubscriptionUrlAsync(Guid userId)
    {
        var existingId = await _dbContext.CalendarSubscription
            .Where(c => c.UserId == userId)
            .Select(c => c.Id)
            .FirstOrDefaultAsync();

        if (existingId == Guid.Empty)
        {
            return null;
        }

        // TODO: Move base URL to configuration if needed
        return $"https://cliq.server-fly.dev/api/Event/ical/{existingId}";
    }

}

public static class EventServiceExtensions
{
    public static IServiceCollection AddEventServices(this IServiceCollection services)
    {
        services.AddScoped<IEventService, EventService>();
        return services;
    }
}
