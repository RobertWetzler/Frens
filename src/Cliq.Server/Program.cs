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

DotNetEnv.Env.Load();

var builder = WebApplication.CreateBuilder(args);

// Listen on all interfaces
builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.ListenAnyIP(8080); // Listen on all interfaces
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
        var pgDb = pgHostPortDb.Split("/")[1];
        var pgUser = pgUserPass.Split(":")[0];
        var pgPass = pgUserPass.Split(":")[1];
        var pgHost = pgHostPort.Split(":")[0];
        var pgPort = pgHostPort.Split(":")[1];
        var updatedHost = pgHost.Replace("flycast", "internal");

        connectionString = $"Server={updatedHost};Port={pgPort};User Id={pgUser};Password={pgPass};Database={pgDb};";

        // Debug: Log the connection string (be careful not to log passwords in real production)
        Console.WriteLine($"Connection string length: {connectionString.Length}");
        Console.WriteLine($"Connection string ends with: '{connectionString.Substring(Math.Max(0, connectionString.Length - 20))}'");
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
builder.Services.AddNotificationsServices();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

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
                .WithOrigins("http://localhost:8081", "exp://localhost:19006")
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
var key = Encoding.ASCII.GetBytes(jwtSettings["Secret"]);

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
    app.UseSwagger();
    app.UseSwaggerUI();
    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<CliqDbContext>();

        // For development, delete and recreate the database to ensure clean migrations
        await db.Database.EnsureDeletedAsync();
        await db.Database.MigrateAsync();

        await SeedExtensions.SeedDevelopmentDataAsync(app.Services);
    }
}
else
{
    // In production, only apply migrations
    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<CliqDbContext>();
        await db.Database.MigrateAsync();
    }
}

// TODO: RE-INTRODUCE! After getting https working in dev-env for API server
//app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.MapFallbackToFile("index.html");

app.Run();
