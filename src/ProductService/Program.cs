using Microsoft.AspNetCore.Server.Kestrel.Core;
using ProductService.GrpcService;
using ProductService.Services;
using ProductService.Settings;
using Prometheus;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.ConfigureKestrel(options =>
{
    options.ListenAnyIP(80, listenOptions =>
    {
        listenOptions.Protocols = HttpProtocols.Http2;
    });
});

builder.Services.AddAutoMapper(typeof(Program));

builder.Services.AddHealthChecks();
// Add services to the container.

builder.Services.AddControllers();
builder.Services.AddGrpc();
builder.Services.AddGrpcReflection();
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
app.UseHttpMetrics();

app.MapControllers();
app.MapGrpcService<ProductGrpcService>();
app.MapGrpcReflectionService();
app.MapMetrics();
app.MapHealthChecks("/healthz");
app.Run();
