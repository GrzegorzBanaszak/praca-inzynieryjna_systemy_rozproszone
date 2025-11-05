using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.IdentityModel.Tokens;
using Prometheus;
using System.Text;

var builder = WebApplication.CreateBuilder(args);


builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["JwtSettings:Issuer"],
            ValidAudience = builder.Configuration["JwtSettings:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["JwtSettings:Key"]!)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(5),
        };
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var contentType = context.Request.ContentType;
                if (!string.IsNullOrEmpty(contentType) && contentType.StartsWith("application/grpc"))
                {
                    var authHeader = context.Request.Headers["authorization"].FirstOrDefault();
                    if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer "))
                    {
                        context.Token = authHeader.Substring("Bearer ".Length).Trim();
                    }
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("authenticated", p => p.RequireAuthenticatedUser());
});

builder.Services.AddControllers();

builder.Services.AddReverseProxy()
       .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

// builder.Services.AddMetricServer(opt => { opt.Port = 9090; });
builder.Services.AddHealthChecks();
var app = builder.Build();


// Autoryzacja
app.UseAuthentication();
app.UseAuthorization();

// Dodanie revers proxy
app.MapReverseProxy();
app.MapControllers();
app.UseRouting();
app.UseAuthorization();
// Rejestruje metryki Prometheus
app.UseMetricServer();
// Zbiera metryki HTTP (latencja, liczba zapytań, kody statusu)
app.UseHttpMetrics();
app.MapHealthChecks("/healthz");
app.Run();
