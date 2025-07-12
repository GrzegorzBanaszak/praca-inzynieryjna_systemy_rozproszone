using NotificationService.Consumers;
using NotificationService.Profiles;
using NotificationService.Services;
using NotificationService.Settings;
using Prometheus;

var builder = WebApplication.CreateBuilder(args);

// 1. Konfiguracje
builder.Services.Configure<KafkaSettings>(
    builder.Configuration.GetSection("KafkaSettings"));
builder.Services.Configure<SmtpSettings>(
    builder.Configuration.GetSection("SmtpSettings"));

// 2. Serwisy
builder.Services.AddSingleton<INotificationService, NotificationServices>();
builder.Services.AddHostedService<OrderPlacedConsumer>();

// 3. AutoMapper
builder.Services.AddAutoMapper(typeof(MappingProfile));

// 4. Prometheus & HealthChecks
builder.Services.AddMetricServer(opt =>
{
    opt.Port = 9090; // Port for Prometheus metrics

});
builder.Services.AddHealthChecks();
builder.Services.AddHealthChecks();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.UseDeveloperExceptionPage();
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
    app.UseSwaggerUI();
}


app.UseRouting();

app.UseMetricServer();    // /metrics
app.UseHttpMetrics();
app.MapHealthChecks("/healthz");

// (opcjonalnie) expose controller do testu
app.MapControllers();


app.Run();
