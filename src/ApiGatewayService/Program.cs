using Prometheus;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();

var app = builder.Build();


// Configure the HTTP request pipeline.


app.MapControllers();
app.UseRouting();
app.UseAuthorization();

// Rejestruje metryki Prometheus
app.UseMetricServer();
// Zbiera metryki HTTP (latencja, liczba zapytań, kody statusu)
app.UseHttpMetrics();
app.Run();
