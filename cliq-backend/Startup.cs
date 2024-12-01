using CliqBackend.Controllers;
using CliqBackend.Data;
using Microsoft.EntityFrameworkCore;

namespace CliqBackend;

public class Startup
{
    public Startup(IConfiguration configuration)
    {
        Configuration = configuration;
    }

    public IConfiguration Configuration { get; }

    public void ConfigureServices(IServiceCollection services)
    {
        services.AddControllers();
        services.AddPostServices();
        services.AddDbContext<ApplicationDbContext>(options =>
        {
            //var connectionString = Environment.ExpandEnvironmentVariables(Configuration.GetConnectionString("DefaultConnection"));
            //var connectionString = Configuration.GetConnectionString("DefaultConnection");
            var connectionString = "Host=localhost;Port=5432;Password=password";
            options.UseNpgsql(connectionString);
        });
    services.AddEndpointsApiExplorer();
        services.AddSwaggerGen();
    }

    public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
    {
        if (env.IsDevelopment())
        {
            app.UseDeveloperExceptionPage();
            app.UseSwagger();
            app.UseSwaggerUI();
        }
        else
        {
            app.UseExceptionHandler("/Error");
            app.UseHsts();
        }

        app.UseHttpsRedirection();
        app.UseStaticFiles();

        app.UseRouting();

        //app.UseAuthorization();

        app.UseEndpoints(endpoints =>
        {
           endpoints.MapControllers();
        });
    }
}