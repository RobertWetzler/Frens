using System.ComponentModel.DataAnnotations;

namespace Cliq.Server.Models;

public class Event : Post
{
    // iCal compatible properties
    public required string Title { get; set; }
    public required DateTime StartDateTime { get; set; }
    public DateTime? EndDateTime { get; set; }
    public string? Location { get; set; }
    public string? Timezone { get; set; } = "UTC";
    
    // Additional properties for extensibility
    public int? MaxAttendees { get; set; }
    public bool IsAllDay { get; set; } = false;
    public bool IsRecurring { get; set; } = false;
    public string? RecurrenceRule { get; set; } // RRULE format for iCal compatibility
    
    // Navigation properties
    public ICollection<EventRsvp> Rsvps { get; set; } = new List<EventRsvp>();
}

public enum RsvpStatus
{
    NoResponse = 0,
    Going = 1,
    Maybe = 2,
    NotGoing = 3
}

public class EventRsvp
{
    public EventRsvp() => Id = Guid.NewGuid();

    public required Guid Id { get; set; }
    public required Guid EventId { get; set; }
    public required Guid UserId { get; set; }
    public required RsvpStatus Status { get; set; }
    public DateTime ResponseDate { get; set; } = DateTime.UtcNow;
    public string? Notes { get; set; }

    // Navigation properties
    public Event Event { get; set; } = null!;
    public User User { get; set; } = null!;
}

// DTOs
public class EventDto : PostDto
{
    public required string Title { get; set; }
    public required DateTime StartDateTime { get; set; }
    public DateTime? EndDateTime { get; set; }
    public string? Location { get; set; }
    public string? Timezone { get; set; } = "UTC";
    public int? MaxAttendees { get; set; }
    public bool IsAllDay { get; set; } = false;
    public bool IsRecurring { get; set; } = false;
    public string? RecurrenceRule { get; set; }
    
    // RSVP summary
    public int GoingCount { get; set; }
    public int MaybeCount { get; set; }
    public int NotGoingCount { get; set; }
    public RsvpStatus? CurrentUserRsvp { get; set; }
    
    public List<EventRsvpDto> Rsvps { get; set; } = new List<EventRsvpDto>();
}

public class EventRsvpDto
{
    public required Guid Id { get; set; }
    public required Guid EventId { get; set; }
    public required Guid UserId { get; set; }
    public required RsvpStatus Status { get; set; }
    public DateTime ResponseDate { get; set; }
    public string? Notes { get; set; }
    public UserDto User { get; set; } = null!;
}

public class CreateEventDto
{
    public required string Title { get; set; }
    public required string Text { get; set; } // Post text (description)
    public required DateTime StartDateTime { get; set; }
    public DateTime? EndDateTime { get; set; }
    public string? Location { get; set; }
    public string? Timezone { get; set; } = "UTC";
    public int? MaxAttendees { get; set; }
    public bool IsAllDay { get; set; } = false;
    public bool IsRecurring { get; set; } = false;
    public string? RecurrenceRule { get; set; }
    
    // Post-related properties
    public Guid[] CircleIds { get; set; } = Array.Empty<Guid>();
}

public class UpdateEventDto
{
    public string? Title { get; set; }
    public string? Text { get; set; } // Post text (description)
    public DateTime? StartDateTime { get; set; }
    public DateTime? EndDateTime { get; set; }
    public string? Location { get; set; }
    public string? Timezone { get; set; }
    public int? MaxAttendees { get; set; }
    public bool? IsAllDay { get; set; }
    public bool? IsRecurring { get; set; }
    public string? RecurrenceRule { get; set; }
}

public class CreateRsvpDto
{
    public required RsvpStatus Status { get; set; }
    public string? Notes { get; set; }
}
