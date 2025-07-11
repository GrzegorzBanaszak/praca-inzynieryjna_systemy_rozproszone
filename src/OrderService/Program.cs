using Confluent.Kafka;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
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

// AutoMapper
builder.Services.AddAutoMapper(typeof(MappingProfile));

// Serwis
builder.Services.AddScoped<IOrderService, OrderServices>();

// JWT auth (reusing UserService JWT setup)
builder.Services.Configure<JwtSettings>(
    builder.Configuration.GetSection("JwtSettings"));

// 2. Odczyt wartoœci JwtSettings do lokalnej zmiennej
var jwtSettings = builder.Configuration
    .GetSection("JwtSettings")
    .Get<JwtSettings>();

// 3. Dodanie autoryzacji JWT
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    var key = Encoding.UTF8.GetBytes(jwtSettings.Key);
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateIssuerSigningKey = true,
        ValidateLifetime = true,

        ValidIssuer = jwtSettings.Issuer,
        ValidAudience = jwtSettings.Audience,
        IssuerSigningKey = new SymmetricSecurityKey(key),

        // opcjonalnie: minimalny czas do koñca wa¿noœci tokenu
        ClockSkew = TimeSpan.FromSeconds(30)
    };
});


// Swagger, HealthChecks, Prometheus
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHealthChecks();
builder.Services.AddMetricServer(opt =>
{
    opt.Port = 9090; // Port for Prometheus metrics

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
