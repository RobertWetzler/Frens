using Cliq.Server.Models;
using Cliq.Server.Services;
using Cliq.Utilities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Cliq.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class EventController : ControllerBase
{
    private readonly IEventService _eventService;
    private readonly ILogger<EventController> _logger;

    public EventController(IEventService eventService, ILogger<EventController> logger)
    {
        _eventService = eventService;
        _logger = logger;
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<EventDto>> GetEvent(Guid id, bool includeRsvps = true)
    {
        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
        {
            return Unauthorized();
        }

        var eventDto = await _eventService.GetEventByIdAsync(userId, id, includeRsvps);
        if (eventDto == null)
        {
            return NotFound();
        }

        return Ok(eventDto);
    }

    [HttpGet("upcoming")]
    public async Task<ActionResult<List<EventDto>>> GetUpcomingEvents(int page = 1, int pageSize = 20)
    {
        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
        {
            return Unauthorized();
        }

        var events = await _eventService.GetUpcomingEventsAsync(userId, page, pageSize);
        return Ok(events);
    }

    [HttpGet("my-events")]
    public async Task<ActionResult<List<EventDto>>> GetMyEvents(int page = 1, int pageSize = 20)
    {
        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
        {
            return Unauthorized();
        }

        var events = await _eventService.GetEventsForUserAsync(userId, page, pageSize);
        return Ok(events);
    }

    [HttpPost]
    public async Task<ActionResult<EventDto>> CreateEvent([FromBody] CreateEventDto createEventDto)
    {
        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
        {
            return Unauthorized();
        }

        try
        {
            var eventDto = await _eventService.CreateEventAsync(userId, createEventDto);
            return CreatedAtAction(nameof(GetEvent), new { id = eventDto.Id }, eventDto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating event for user {UserId}", userId);
        if (ex is BadHttpRequestException)
            {
                return BadRequest(ex.Message);
            }
            return StatusCode(500, "An error occurred while creating the event");
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<EventDto>> UpdateEvent(Guid id, [FromBody] UpdateEventDto updateEventDto)
    {
        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
        {
            return Unauthorized();
        }

        var eventDto = await _eventService.UpdateEventAsync(id, userId, updateEventDto);
        if (eventDto == null)
        {
            return NotFound();
        }

        return Ok(eventDto);
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteEvent(Guid id)
    {
        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
        {
            return Unauthorized();
        }

        var success = await _eventService.DeleteEventAsync(id, userId);
        if (!success)
        {
            return NotFound();
        }

        return NoContent();
    }

    [HttpPost("{id}/rsvp")]
    public async Task<ActionResult<EventRsvpDto>> RsvpToEvent(Guid id, [FromBody] CreateRsvpDto rsvpDto)
    {
        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
        {
            return Unauthorized();
        }

        var rsvp = await _eventService.RsvpToEventAsync(id, userId, rsvpDto);
        if (rsvp == null)
        {
            return NotFound("Event not found or access denied");
        }

        return Ok(rsvp);
    }

    [HttpDelete("{id}/rsvp")]
    public async Task<ActionResult> RemoveRsvp(Guid id)
    {
        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
        {
            return Unauthorized();
        }

        var success = await _eventService.RemoveRsvpAsync(id, userId);
        if (!success)
        {
            return NotFound();
        }

        return NoContent();
    }

    [HttpGet("{id}/rsvps")]
    public async Task<ActionResult<List<EventRsvpDto>>> GetEventRsvps(Guid id)
    {
        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
        {
            return Unauthorized();
        }

        // First check if user has access to the event
        var eventDto = await _eventService.GetEventByIdAsync(userId, id, false);
        if (eventDto == null)
        {
            return NotFound();
        }

        var rsvps = await _eventService.GetEventRsvpsAsync(id);
        return Ok(rsvps);
    }

    [HttpGet("{id}/ical")]
    public async Task<ActionResult> GetEventICalendar(Guid id)
    {
        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
        {
            return Unauthorized();
        }

        // Check if user has access to the event
        var eventDto = await _eventService.GetEventByIdAsync(userId, id, false);
        if (eventDto == null)
        {
            return NotFound();
        }

        try
        {
            var icalContent = await _eventService.GenerateICalAsync(id);
            return File(
                System.Text.Encoding.UTF8.GetBytes(icalContent),
                "text/calendar",
                $"event-{id}.ics"
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating iCal for event {EventId}", id);
            return StatusCode(500, "An error occurred while generating the calendar file");
        }
    }
}
