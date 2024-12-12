using AutoMapper;
using Cliq.Server.Data;
using Cliq.Server.Services;
using Cliq.Server.Utilities;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

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

app.UseAuthorization();

app.MapControllers();

app.MapFallbackToFile("/index.html");

app.Run();
