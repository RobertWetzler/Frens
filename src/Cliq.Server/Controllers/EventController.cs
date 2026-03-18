using Cliq.Server.Models;
using Cliq.Server.Services;
using Cliq.Utilities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Reflection.PortableExecutable;
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
    public async Task<ActionResult<MyEventsResponse>> GetMyEvents(int page = 1, int pageSize = 20)
    {
        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
        {
            return Unauthorized();
        }

        var events = await _eventService.GetEventsForUserAsync(userId, page, pageSize);
        var subscriptionUrl = await _eventService.GetICalSubscriptionUrlAsync(userId);
        return Ok(new MyEventsResponse
        {
            Events = events,
            CalendarSubscriptionUrl = subscriptionUrl
        });
    }

    [HttpPost]
    [RequestSizeLimit(50_000_000)]
    [Consumes("multipart/form-data", "application/json")]
    [ProducesResponseType(typeof(EventDto), StatusCodes.Status201Created)]
    public async Task<ActionResult<EventDto>> CreateEvent([FromForm] CreateEventWithImageRequest request)
    {
        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
        {
            return Unauthorized();
        }

        try
        {
            var imageKeys = new List<string>();
            if (request.Images != null && request.Images.Count > 0)
            {
                var allowed = new[] { "image/png", "image/jpeg", "image/heic", "image/webp" };
                long totalBytes = 0;
                var storage = HttpContext.RequestServices.GetService<IObjectStorageService>();
                var imageProcessor = HttpContext.RequestServices.GetService<IImageProcessingService>();
                if (storage == null)
                {
                    return StatusCode(StatusCodes.Status500InternalServerError, "Storage service not available");
                }
                if (imageProcessor == null)
                {
                    return StatusCode(StatusCodes.Status500InternalServerError, "Image processing service not available");
                }
                foreach (var img in request.Images)
                {
                    if (img == null || img.Length == 0) continue;
                    if (!allowed.Contains(img.ContentType))
                    {
                        return BadRequest($"Unsupported image content type: {img.ContentType}");
                    }
                    if (img.Length > 25_000_000)
                    {
                        return BadRequest($"Single image too large (>25MB): {img.FileName}");
                    }
                    await using var originalStream = img.OpenReadStream();
                    var (processedStream, outputContentType) = await imageProcessor.ProcessAsync(
                        originalStream, img.ContentType, maxWidth: 1920, maxHeight: 1920, preferredMaxBytes: 1_000_000);
                    totalBytes += processedStream.Length;
                    if (totalBytes > 50_000_000)
                    {
                        return BadRequest("Total images payload too large (>50MB)");
                    }
                    var key = await storage.UploadPostImageAsync(userId, processedStream, outputContentType);
                    imageKeys.Add(key);
                }
            }

            var createEventDto = new CreateEventDto
            {
                Title = request.Title,
                Text = request.Text,
                StartDateTime = request.StartDateTime,
                EndDateTime = request.EndDateTime,
                Location = request.Location,
                Timezone = request.Timezone,
                MaxAttendees = request.MaxAttendees,
                IsAllDay = request.IsAllDay,
                IsRecurring = request.IsRecurring,
                RecurrenceRule = request.RecurrenceRule,
                CircleIds = request.CircleIds,
                UserIds = request.UserIds
            };

            var eventDto = await _eventService.CreateEventAsync(userId, createEventDto, imageKeys);
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

    [HttpPost("ical/subscribe")]
    public async Task<ActionResult<string>> SubscribeToICalendar()
    {
        if (!AuthUtils.TryGetUserIdFromToken(HttpContext, out var userId))
        {
            return Unauthorized();
        }

        // Generate unique subscription link
        var subscriptionId = await _eventService.CreateICalSubscriptionAsync(userId);
        var url = $"https://cliq-server.fly.dev/api/Event/ical/{subscriptionId}";
        return Ok(url);
    }

    [HttpGet("ical/{subscriptionId}")]
    [AllowAnonymous]
    public async Task<ActionResult> GetICalendar(Guid subscriptionId)
    {

        string icalContent;
        try
        {
            icalContent = await _eventService.GenerateICalForSubscriptionAsync(subscriptionId);
        }
        catch (ArgumentException)
        {
            _logger.LogWarning($"Invalid calendar subscriptionId queried: {subscriptionId}");
            return NotFound();
        }
        try
        {
            return File(
                System.Text.Encoding.UTF8.GetBytes(icalContent),
                "text/calendar",
                $"frens.ics"
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating iCal for subscription {subscriptionId}", subscriptionId);
            return StatusCode(500, "An error occurred while generating the calendar file");
        }
    }
}

public class MyEventsResponse
{
    public required List<EventDto> Events { get; set; }
    public string? CalendarSubscriptionUrl { get; set; }
}
