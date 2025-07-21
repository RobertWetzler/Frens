using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Cliq.Server.Utilities;

public class SwaggerTestTokenFilter : IDocumentFilter
{
    public void Apply(OpenApiDocument swaggerDoc, DocumentFilterContext context)
    {
        // This filter will be used to inject custom JavaScript for auto-populating the auth token
        // The actual JavaScript injection will be done via SwaggerUI options
    }
}
