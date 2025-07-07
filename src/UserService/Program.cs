using Prometheus;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();

var app = builder.Build();

// Configure the HTTP request pipeline.

app.UseAuthorization();
// Rejestruje metryki Prometheus
app.UseMetricServer();
// Zbiera metryki HTTP (latencja, liczba zapytañ, kody statusu)
app.UseHttpMetrics();

app.MapControllers();

app.Run();
