using System.Text.Json;
using System.Text.Json.Serialization;
using Cliq.Server.Models;

namespace Cliq.Server.Utilities;

public class JsonInheritanceConverter : JsonConverter<PostDto>
{
    private readonly string _discriminatorPropertyName;

    public JsonInheritanceConverter(string discriminatorPropertyName)
    {
        _discriminatorPropertyName = discriminatorPropertyName;
    }

    public override bool CanConvert(Type typeToConvert)
    {
        return typeof(PostDto).IsAssignableFrom(typeToConvert);
    }

    public override PostDto Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        using var doc = JsonDocument.ParseValue(ref reader);
        var root = doc.RootElement;

        // Check for discriminator property
        if (root.TryGetProperty(_discriminatorPropertyName, out var discriminatorElement))
        {
            var discriminatorValue = discriminatorElement.GetString();
            
            return discriminatorValue switch
            {
                "event" => JsonSerializer.Deserialize<EventDto>(root.GetRawText(), options)!,
                "post" or _ => JsonSerializer.Deserialize<PostDto>(root.GetRawText(), options)!
            };
        }

        // Default to PostDto if no discriminator found
        return JsonSerializer.Deserialize<PostDto>(root.GetRawText(), options)!;
    }

    public override void Write(Utf8JsonWriter writer, PostDto value, JsonSerializerOptions options)
    {
        writer.WriteStartObject();

        // Write discriminator property
        writer.WriteString(_discriminatorPropertyName, value is EventDto ? "event" : "post");

        // Serialize the object based on its actual type
        var jsonString = value switch
        {
            EventDto eventDto => JsonSerializer.Serialize(eventDto, options),
            _ => JsonSerializer.Serialize(value, options)
        };

        // Parse the serialized object and write all properties except the discriminator
        using var doc = JsonDocument.Parse(jsonString);
        foreach (var property in doc.RootElement.EnumerateObject())
        {
            if (property.Name != _discriminatorPropertyName)
            {
                property.WriteTo(writer);
            }
        }

        writer.WriteEndObject();
    }
}
