using NotificationService.Consumers;
using NotificationService.Profiles;
using NotificationService.Services;
using NotificationService.Settings;
using Prometheus;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddHealthChecks(); ; //  endpoint /healthz


// 1. Konfiguracje
builder.Services.Configure<KafkaSettings>(
    builder.Configuration.GetSection("KafkaSettings"));
// builder.Services.Configure<SmtpSettings>(
//     builder.Configuration.GetSection("SmtpSettings"));

builder.Services.Configure<HostOptions>(o =>
{
    o.BackgroundServiceExceptionBehavior = BackgroundServiceExceptionBehavior.Ignore;
});
// 2. Serwisy
builder.Services.AddSingleton<INotificationService, NotificationServices>();

builder.Services.AddHostedService<OrderPlacedConsumer>();
// 3. AutoMapper
builder.Services.AddAutoMapper(typeof(MappingProfile));
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();


// Dodaj HttpClient dla NotificationService (do wywołań synchronicznych)
builder.Services.AddHttpClient("NotificationService", client =>
{
    // W środowisku Kubernetes serwis będzie dostępny pod tą nazwą
    var baseUrl = builder.Configuration.GetValue<string>("NotificationService:BaseUrl")
                  ?? "http://notificationservice";
    client.BaseAddress = new Uri(baseUrl);
    client.Timeout = TimeSpan.FromSeconds(30); // Timeout dla żądań synchronicznych
});

var app = builder.Build();


app.UseRouting();
app.UseMetricServer();    // /metrics
app.UseHttpMetrics();

app.MapHealthChecks("/healthz").AllowAnonymous();
app.MapMetrics();
app.MapControllers();


app.Run();
