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

DotNetEnv.Env.Load();

var builder = WebApplication.CreateBuilder(args);

// Listen on all interfaces
builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.ListenAnyIP(5265); // Listen on all interfaces
});

// Add services to the container.
builder.Services.AddDbContext<CliqDbContext>(options =>
{
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"));
});
builder.Services.AddControllers();
// AutoMapper used for mapping entity classes to DataTransfer Objects (DTOs) visible to user
var mapperConfig = new MapperConfiguration(c => c.AddProfile(new MappingProfile()));
builder.Services.AddSingleton<IMapper>(mapperConfig.CreateMapper());

builder.Services.AddPostServices();
builder.Services.AddCommentServices();
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
var supabaseSecretKey = Environment.GetEnvironmentVariable("JWT_SECRET");
if (supabaseSecretKey == null)
{
    throw new InvalidConfigurationException("Missing supabase signature key!");
}
var supabaseSignatureKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(supabaseSecretKey));
// TOOD: replace valid issuer with env for supabase endpoint
var validIssuer = "http://192.168.0.21:8000/auth/v1";
var validAudiences = new List<string>() { "authenticated" };

builder.Services.AddAuthentication().AddJwtBearer(o =>
{
    o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = supabaseSignatureKey,
        ValidAudiences = validAudiences,
        ValidIssuer = validIssuer,
        ValidateLifetime = true
    };

    o.Events = new JwtBearerEvents
    {
        OnTokenValidated = context =>
        {
            Console.WriteLine("Token validated");
            return Task.CompletedTask;
        },
        OnAuthenticationFailed = context =>
        {
            Console.WriteLine($"Authentication failed: {context.Exception.Message}");
            return Task.CompletedTask;
        },
        OnChallenge = context =>
        {
            Console.WriteLine($"OnChallenge: {context.Error}, {context.ErrorDescription}");
            return Task.CompletedTask;
        }
    };
});
// Require authentication on endpoints by default when no other attribute is specified (AllowAnonymous, Authorize, etc).
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
}
);
# endregion

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();
app.UseCors("ExpoApp");
// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<CliqDbContext>();
        db.Database.EnsureDeleted(); // Drops the database if it exists
        db.Database.EnsureCreated(); // Creates the database and schema
        // Or use migrations instead:
        //db.Database.Migrate();
    }
}


// TODO: RE-INTRODUCE! After getting https working in dev-env for API server
//app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();


app.MapControllers();

app.MapFallbackToFile("/index.html");

app.Run();
