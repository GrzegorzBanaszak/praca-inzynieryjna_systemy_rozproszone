using System;
using System.Text.Json;
using Confluent.Kafka;
using Microsoft.Extensions.Options;
using NotificationService.Dtos;
using NotificationService.Services;
using NotificationService.Settings;

namespace NotificationService.Consumers;

public class OrderPlacedConsumer : BackgroundService
{
    private readonly KafkaSettings _kafka;
    private readonly INotificationService _notifier;
    private readonly ILogger<OrderPlacedConsumer> _logger;
    private IConsumer<Null, string>? _consumer;

    public OrderPlacedConsumer(
        IOptions<KafkaSettings> kafkaOptions,
        INotificationService notifier,
        ILogger<OrderPlacedConsumer> logger)
    {
        _kafka = kafkaOptions.Value;
        _notifier = notifier;
        _logger = logger;
    }

    public override Task StartAsync(CancellationToken cancellationToken)
    {
        var cfg = new ConsumerConfig
        {
            BootstrapServers = _kafka.BootstrapServers,
            GroupId = _kafka.GroupId,
            AutoOffsetReset = AutoOffsetReset.Earliest,
            EnableAutoCommit = true,
        };

        _consumer = new ConsumerBuilder<Null, string>(cfg).Build();
        _consumer.Subscribe(_kafka.Topic);
        _logger.LogInformation("Kafka consumer subscribed to topic {Topic}", _kafka.Topic);
        return base.StartAsync(cancellationToken);
    }


    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (_consumer is null) return;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var cr = _consumer.Consume(stoppingToken);
                var dto = JsonSerializer.Deserialize<OrderDto>(cr.Message.Value!);
                if (dto is not null)
                    await _notifier.NotifyAsync(dto);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Błąd podczas konsumpcji Kafka");
            }
        }
    }

    public override Task StopAsync(CancellationToken cancellationToken)
    {
        _consumer?.Close();
        return base.StopAsync(cancellationToken);
    }
}
