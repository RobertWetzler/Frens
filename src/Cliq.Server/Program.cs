using AutoMapper;
using Cliq.Server.Data;
using Cliq.Server.Services;
using Cliq.Server.Utilities;
using Microsoft.EntityFrameworkCore;
using System.Text;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Authentication;
using Microsoft.IdentityModel.Tokens;
using Microsoft.IdentityModel.Protocols.Configuration;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.UI;
using Cliq.Server.Auth;
using Cliq.Server.Models;
using System.Security.Claims;
using System.Text.Json.Serialization;
using System.Linq;
using Cliq.Server.Services.PushNotifications;
using Microsoft.OpenApi.Models;
using Microsoft.AspNetCore.Builder;
using System.Security.Cryptography.X509Certificates;
using NSwag;
using NSwag.Generation.Processors.Security;

DotNetEnv.Env.Load();

var builder = WebApplication.CreateBuilder(args);

// Listen on all interfaces
builder.WebHost.ConfigureKestrel(serverOptions =>
{
    if (builder.Environment.IsDevelopment())
    {
        // Development: Listen on both HTTP and HTTPS (Allows testing PWA installability)
        serverOptions.ListenAnyIP(5188); // HTTP

    // Try to load self-signed cert from appsettings.Development.json (PEM + KEY)
    var certPath = builder.Configuration["DevHttps:PemPath"];
    var keyPath = builder.Configuration["DevHttps:KeyPath"];

    serverOptions.ListenAnyIP(7188, listenOptions =>
        {
            if (!string.IsNullOrEmpty(certPath) && !string.IsNullOrEmpty(keyPath))
            {
                var fullCertPath = Path.Combine(builder.Environment.ContentRootPath, certPath);
                var fullKeyPath = Path.Combine(builder.Environment.ContentRootPath, keyPath);
                Console.WriteLine($"Using development HTTPS certificate: cert={fullCertPath}, key={fullKeyPath}");
        // Ensure the cert has an associated private key
        var loaded = X509Certificate2.CreateFromPemFile(fullCertPath, fullKeyPath);
        // Convert to PFX so the private key is attached for Kestrel
        var pfxBytes = loaded.Export(X509ContentType.Pkcs12);
#pragma warning disable SYSLIB0057 // Obsolete warning for constructor; acceptable for dev only
        var withKey = new X509Certificate2(pfxBytes, (string?)null, X509KeyStorageFlags.Exportable);
#pragma warning restore SYSLIB0057
        listenOptions.UseHttps(withKey);
            }
            else
            {
                // Fallback to default dev cert (dotnet dev-certs)
                Console.WriteLine("Development HTTPS certificate settings not found; falling back to default dev certificate.");
                listenOptions.UseHttps();
            }
        });
    }
    else
    {
        // Production: Listen only on port 8080 (fly.io handles HTTPS termination)
        serverOptions.ListenAnyIP(8080);
    }
});


// Add services to the container.
builder.Services.AddDbContext<CliqDbContext>(options =>
{
    string connectionString;

    if (builder.Environment.IsProduction())
    {
        // In production, use the DATABASE_URL environment variable
        var connUrl = Environment.GetEnvironmentVariable("DATABASE_URL")
            ?? throw new InvalidOperationException("DATABASE_URL environment variable is not set in production.");
        // Parse connection URL to connection string for Npgsql
        connUrl = connUrl.Replace("postgres://", string.Empty);
        var pgUserPass = connUrl.Split("@")[0];
        var pgHostPortDb = connUrl.Split("@")[1];
        var pgHostPort = pgHostPortDb.Split("/")[0];
        var pgDbWithParams = pgHostPortDb.Split("/")[1];

        // Check if there are query parameters and extract them
        var pgDb = pgDbWithParams;
        var sslParams = "";
        if (pgDbWithParams.Contains("?"))
        {
            var parts = pgDbWithParams.Split("?");
            pgDb = parts[0];
            var queryParams = parts[1];
            
            // Check for sslmode=disable
            if (queryParams.Contains("sslmode=disable"))
            {
                sslParams = "SslMode=Disable;";
            }
        }

        var pgUser = pgUserPass.Split(":")[0];
        var pgPass = pgUserPass.Split(":")[1];
        var pgHost = pgHostPort.Split(":")[0];
        var pgPort = pgHostPort.Split(":")[1];

        connectionString = $"Server={pgHost};Port={pgPort};User Id={pgUser};Password={pgPass};Database={pgDb};{sslParams}";

        // Debug: Log the connection string (excluding password for security)
        var safeConnectionString = $"Server={pgHost};Port={pgPort};User Id={pgUser};Password=***;Database={pgDb};{sslParams}";

        Console.WriteLine($"Connection string: {safeConnectionString}");
        Console.WriteLine($"Host: {pgHost}, Port: {pgPort}, Database: {pgDb}, User: {pgUser}");
}
    else
    {
        // In development, use the connection string from configuration
        connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("DefaultConnection is not configured.");
    }

    options.UseNpgsql(connectionString);
});
builder.Services.AddControllers().AddJsonOptions(o =>
{
    o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    // o.JsonSerializerOptions.TypeInfoResolverChain.Add(new DefaultJsonTypeInfoResolver());
});
// Require authentication for all controllers by default
builder.Services.AddMvcCore(options =>
{
    var policy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
    options.Filters.Add(new Microsoft.AspNetCore.Mvc.Authorization.AuthorizeFilter(policy));
});
// AutoMapper used for mapping entity classes to DataTransfer Objects (DTOs) visible to user
var mapperConfig = new MapperConfiguration(c => c.AddProfile(new MappingProfile()));
builder.Services.AddSingleton<IMapper>(mapperConfig.CreateMapper());

builder.Services.AddPostServices();
builder.Services.AddCircleServices();
builder.Services.AddCommentServices();
builder.Services.AddFriendshipServices();
builder.Services.AddEventServices();
builder.Services.AddNotificationServices(builder.Configuration);
builder.Services.AddScoped<IEventNotificationService, EventNotificationService>();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
/** 
builder.Services.AddSwaggerGen(option =>
{
    // The following basically adds a text box in Swagger UI to enter a Bearer token
    // Taken from https://stackoverflow.com/questions/77750604/how-to-integrate-swagger-into-asp-net-core-web-api-with-identity-server
    option.SwaggerDoc("v1", new OpenApiInfo { 
        Title = "Cliq API", 
        Version = "v1",
        Description = builder.Environment.IsDevelopment() ? 
            "Development API - Use /api/testauth/generate-test-token to get a test JWT token for authentication" : 
            "Cliq API"
    });
    
    option.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        In = ParameterLocation.Header,
        Description = builder.Environment.IsDevelopment() ? 
            "Please enter a valid token. In development, call /api/testauth/generate-test-token to get a test token." : 
            "Please enter a valid token",
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        BearerFormat = "JWT",
        Scheme = "Bearer"
    });
    option.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type=ReferenceType.SecurityScheme,
                    Id="Bearer"
                }
            },
            new string[]{}
        }
    });
});
*/
builder.Services.AddOpenApiDocument(options =>
{
    options.Title = "Cliq API";
    // Define a Bearer security scheme so Swagger UI can attach the JWT to requests
    options.AddSecurity("Bearer", new NSwag.OpenApiSecurityScheme
    {
        Type = NSwag.OpenApiSecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Name = "Authorization",
        In = NSwag.OpenApiSecurityApiKeyLocation.Header,
        Description = builder.Environment.IsDevelopment()
            ? "Enter your JWT token. You can use the 'auto-login' button to fetch one."
            : "Enter your JWT token."
    });

    // Apply the Bearer requirement to operations discovered as requiring authorization
    options.OperationProcessors.Add(new AspNetCoreOperationSecurityScopeProcessor("Bearer"));
});
if (builder.Environment.IsDevelopment())
{
    builder.Services.AddCors(options =>
    {
        options.AddPolicy("AllowViteClient",
            builder => builder
                .SetIsOriginAllowed(_ => true) // Be careful with this in production
                .AllowAnyHeader()
                .AllowAnyMethod());
        options.AddPolicy("ExpoApp",
            builder => builder
                // TODO: Update to prod domain, only use localhost CORS in dev-env
                .WithOrigins("http://localhost:8081", "exp://localhost:19006", "https://192.168.0.109:7189")
                .AllowAnyMethod()
                .AllowAnyHeader()
        );
    });
}
else
{
    Console.WriteLine("Cors is Disabled!");
}

builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();

# region Authentication
builder.Services.AddScoped<JwtService>();
// TODO: Change confirmation to required when adding email auth
/* Why does this not work, example from docs
 * builder.Services.AddDefaultIdentity<IdentityUser>(options => options.SignIn.RequireConfirmedAccount = true)
    .AddEntityFrameworkStores<ApplicationDbContext>(); 
builder.Services.AddDefaultIdentity<IdentityUser>(options => options.SignIn.RequireConfirmedAccount = true)
    .AddEntityFrameworkStores<ApplicationDbContext>(); */

builder.Services.AddIdentity<User, CliqRole>(options => options.SignIn.RequireConfirmedAccount = false)
    .AddEntityFrameworkStores<CliqDbContext>();

builder.Services.Configure<IdentityOptions>(options =>
{
    // Password settings.
    options.Password.RequireDigit = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireNonAlphanumeric = true;
    options.Password.RequireUppercase = true;
    options.Password.RequiredLength = 6;
    options.Password.RequiredUniqueChars = 1;

    // Lockout settings.
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.AllowedForNewUsers = true;

    // User settings.
    options.User.AllowedUserNameCharacters =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._@+";
    options.User.RequireUniqueEmail = true;
});

builder.Services.ConfigureApplicationCookie(options =>
{
    // Cookie settings
    options.Cookie.HttpOnly = true;
    options.ExpireTimeSpan = TimeSpan.FromMinutes(5);

    options.LoginPath = "/Identity/Account/Login";
    options.AccessDeniedPath = "/Identity/Account/AccessDenied";
    options.SlidingExpiration = true;
});
# endregion
var jwtSettings = builder.Configuration.GetSection("JwtSettings");

byte[] key;
// Get key from env variable in production
if (string.IsNullOrEmpty(jwtSettings["Secret"]))
{
    var envKey = Environment.GetEnvironmentVariable("JWT_SECRET");
    if (string.IsNullOrEmpty(envKey))
    {
        throw new InvalidOperationException("JWT secret is not configured. Set JWT_SECRET environment variable or configure JwtSettings in appsettings.");
    }
    key = Encoding.ASCII.GetBytes(envKey);
}
else
{
    key = Encoding.ASCII.GetBytes(jwtSettings["Secret"]!);
}
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false; // TODO: Set to true in production
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidIssuer = jwtSettings["Issuer"],
        ValidAudience = jwtSettings["Audience"],
        ClockSkew = TimeSpan.Zero
    };
    // Add events to validate user exists in database on each request
    options.Events = new JwtBearerEvents
    {
        OnTokenValidated = async context =>
        {
            var userManager = context.HttpContext.RequestServices.GetRequiredService<UserManager<User>>();
            var userId = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);

            if (userId == null)
            {
                context.Fail("Unauthorized: User identifier claim not found");
                return;
            }

            var user = await userManager.FindByIdAsync(userId);
            if (user == null)
            {
                // User no longer exists in the database
                context.Fail("Unauthorized: User no longer exists");
                return;
            }
        }
    };
});
var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();



// TODO Figure out correct CORS for mobile app
app.UseCors("ExpoApp");
// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseOpenApi();
    app.UseSwaggerUi(c =>
    {
        c.CustomJavaScriptPath = "/swagger-custom.js";
        c.CustomInlineStyles = "/swagger-custom.css";
    });
    // Serve custom Swagger assets from Assets folder
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
            Path.Combine(Directory.GetCurrentDirectory(), "Assets", "swagger")),
        RequestPath = ""
    });
}

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<CliqDbContext>();
    await db.Database.MigrateAsync();
    
    if (app.Environment.IsDevelopment())
    {
        await SeedExtensions.SeedDevelopmentDataAsync(app.Services);
    }
}

// TODO: RE-INTRODUCE! After getting https working in dev-env for API server
//app.UseHttpsRedirection();

// Ensure authentication runs before authorization so JWTs are evaluated
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapFallbackToFile("index.html");

app.Run();
