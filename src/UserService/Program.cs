using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Prometheus;
using System.Text;
using UserService.Data;
using UserService.Services;
using UserService.Settings;

var builder = WebApplication.CreateBuilder(args);


builder.Services.AddMetricServer(opt =>
{
    opt.Port = 9090; // Port for Prometheus metrics

});
builder.Services.AddHealthChecks(); // domyœlnie endpoint /healthz

//EF Core
builder.Services.AddDbContext<UserDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Jwt Settings
builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("JwtSettings"));

// Services
builder.Services.AddScoped<IAuthService, AuthService>();

// Authentication
var jwt = builder.Configuration.GetSection("JwtSettings").Get<JwtSettings>();
builder.Services.AddAuthentication(opt =>
{
    opt.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    opt.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
}).
AddJwtBearer(o =>
{
    var key = Encoding.ASCII.GetBytes(jwt.Key);
    o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwt.Issuer,
        ValidAudience = jwt.Audience,
        IssuerSigningKey = new SymmetricSecurityKey(key)
    };
});

// AutoMapper, Controllers, Swagger, HealthChecks
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHealthChecks();


var app = builder.Build();

app.UseDeveloperExceptionPage();
app.UseSwagger();
app.UseSwaggerUI();
app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.UseHttpMetrics();

app.MapHealthChecks("/healthz");
app.MapMetrics();
app.MapControllers();

app.Run();
