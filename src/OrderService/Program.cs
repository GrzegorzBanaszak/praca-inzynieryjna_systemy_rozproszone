using Confluent.Kafka;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using OrderService.Common;
using OrderService.Data;
using OrderService.Profiles;
using OrderService.Services;
using OrderService.Settings;
using Prometheus;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// EF Core
builder.Services.AddDbContext<OrderDbContext>(opts =>
    opts.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Kafka settings + producer
builder.Services.Configure<KafkaSettings>(
    builder.Configuration.GetSection("KafkaSettings"));
builder.Services.AddSingleton(sp =>
{
    var cfg = sp.GetRequiredService<IOptions<KafkaSettings>>().Value;
    var prodCfg = new ProducerConfig { BootstrapServers = cfg.BootstrapServers };
    return new ProducerBuilder<Null, string>(prodCfg).Build();
});

builder.Services.AddSingleton<IAdminClient>(sp =>
{
    var cfg = sp.GetRequiredService<IOptions<KafkaSettings>>().Value;
    return new AdminClientBuilder(new AdminClientConfig
    {
        BootstrapServers = cfg.BootstrapServers
    }).Build();
});

// HostedService, który upewni się, że topic istnieje
builder.Services.AddHostedService<KafkaTopicInitializer>();
// AutoMapper
builder.Services.AddAutoMapper(typeof(MappingProfile));

// Serwis
builder.Services.AddScoped<IOrderService, OrderServices>();

// JWT auth (reusing UserService JWT setup)
builder.Services.Configure<JwtSettings>(
    builder.Configuration.GetSection("JwtSettings"));

var jwtSettings = builder.Configuration
    .GetSection("JwtSettings")
    .Get<JwtSettings>();

// 3. Dodanie autoryzacji JWT
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
  .AddJwtBearer(options =>
  {
      var keyBytes = Encoding.UTF8.GetBytes(jwtSettings.Key);
      options.TokenValidationParameters = new TokenValidationParameters
      {
          ValidateIssuerSigningKey = true,
          IssuerSigningKey = new SymmetricSecurityKey(keyBytes),
          ValidateIssuer = true,
          ValidIssuer = jwtSettings.Issuer,
          ValidateAudience = true,
          ValidAudience = jwtSettings.Audience,

          ValidateLifetime = true,
          ClockSkew = TimeSpan.FromMinutes(5),
      };
  });


// Swagger, HealthChecks, Prometheus
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Order service API",
        Version = "v1"
    });

    // 1. Definicja schematu Bearer
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "Wpisz Bearer + token JWT",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    // 2. Wymaganie globalne (ka�dego endpointu)
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        [new OpenApiSecurityScheme
        {
            Reference = new OpenApiReference
            {
                Type = ReferenceType.SecurityScheme,
                Id = "Bearer"
            }
        }
        ] = Array.Empty<string>()
    });
});
builder.Services.AddHealthChecks();




var app = builder.Build();
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<OrderDbContext>();
    db.Database.Migrate();
}

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseRouting();
app.UseMetricServer();
app.UseHttpMetrics();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/healthz");
app.MapMetrics();

app.Run();
