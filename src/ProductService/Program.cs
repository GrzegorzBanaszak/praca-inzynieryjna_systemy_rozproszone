using ProductService.Services;
using ProductService.Settings;
using Prometheus;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddAutoMapper(typeof(Program));


builder.Services.AddMetricServer(opt =>
{
    opt.Port = 9090; // Port for Prometheus metrics

});
builder.Services.AddHealthChecks();
// Add services to the container.

builder.Services.AddControllers();
builder.Services.Configure<MongoDbSettings>(
    builder.Configuration.GetSection("MongoDbSettings"));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddSingleton<IProductService, ProductServices>();


var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "ProductService V1");
    });
}

// Configure the HTTP request pipeline.
app.UseAuthorization();
// Rejestruje metryki Prometheus
app.UseMetricServer();
// Zbiera metryki HTTP (latencja, liczba zapytañ, kody statusu)
app.UseHttpMetrics();

app.MapControllers();
app.MapMetrics();
app.Run();
