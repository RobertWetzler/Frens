using System.Linq;
using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using NSwag;
using NSwag.Generation.Processors;
using NSwag.Generation.Processors.Contexts;
using System.Collections.Generic;

namespace Cliq.Server.Utilities.Swagger
{
    /// <summary>
    /// Ensures every operation (except those explicitly marked with [AllowAnonymous])
    /// has the Bearer security requirement so Swagger UI will attach the JWT.
    /// This is needed because a global authorization filter (added via MVC options)
    /// is not visible to NSwag's built-in AspNetCoreOperationSecurityScopeProcessor.
    /// </summary>
    public class GlobalAuthOperationProcessor : IOperationProcessor
    {
        public bool Process(OperationProcessorContext context)
        {
            // If action or controller explicitly allows anonymous, skip.
            var hasAllowAnonymous =
                context.MethodInfo.GetCustomAttributes(true).OfType<AllowAnonymousAttribute>().Any() ||
                context.ControllerType.GetCustomAttributes(true).OfType<AllowAnonymousAttribute>().Any();
            if (hasAllowAnonymous)
                return true;

            // Ensure security list exists
            var operation = context.OperationDescription.Operation;
            operation.Security ??= new System.Collections.Generic.List<NSwag.OpenApiSecurityRequirement>();

            // Add Bearer requirement if not already present
            // In some NSwag versions the key is just the scheme name string
            var alreadyAdded = operation.Security.Any(req => req.Keys.Any(k => k == "Bearer"));
            if (!alreadyAdded)
            {
                var requirement = new NSwag.OpenApiSecurityRequirement();
                requirement.Add("Bearer", new List<string>());
                operation.Security.Add(requirement);                
            }

            return true;
        }
    }
}
