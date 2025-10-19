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

    private IConsumer<Ignore, string>? _consumer;

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
        _logger.LogInformation(
            "OrderPlacedConsumer StartAsync() invoked. BootstrapServers={Servers}, GroupId={Group}",
            _kafka.BootstrapServers, _kafka.GroupId);

        // NIE tworzymy tutaj konsumera - to zostanie zrobione w ExecuteAsync
        return base.StartAsync(cancellationToken);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("OrderPlacedConsumer loop starting...");

        var backoff = TimeSpan.FromSeconds(5);
        var consecutiveErrors = 0;

        // Daj aplikacji czas na pełny start
        await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // Leniwe tworzenie konsumera
                if (_consumer is null)
                {
                    _logger.LogInformation("Creating Kafka consumer...");

                    var cfg = new ConsumerConfig
                    {
                        BootstrapServers = _kafka.BootstrapServers,
                        GroupId = _kafka.GroupId,
                        AutoOffsetReset = AutoOffsetReset.Earliest,
                        EnableAutoCommit = true,

                        // Krótsze timeouty dla responsywności
                        SocketTimeoutMs = 5000,
                        SessionTimeoutMs = 10000,
                        MetadataMaxAgeMs = 10_000,
                        // Ważne: szybkie wykrywanie problemów z połączeniem
                        SocketKeepaliveEnable = true,
                    };

                    try
                    {
                        _consumer = new ConsumerBuilder<Ignore, string>(cfg)
                            .SetErrorHandler((_, e) =>
                            {
                                _logger.LogWarning("Kafka error: {Reason} (isFatal={Fatal})",
                                    e.Reason, e.IsFatal);
                                if (e.IsFatal)
                                {
                                    // Fatal error - wymuszamy ponowne utworzenie konsumera
                                    SafeClose();
                                }
                            })
                            .SetLogHandler((_, m) =>
                                _logger.LogDebug("librdkafka [{Name}] {Fac}: {Message}",
                                    m.Name, m.Facility, m.Message))
                            .Build();

                        _consumer.Subscribe(_kafka.Topic);
                        _logger.LogInformation(
                            "Kafka consumer created & subscribed successfully. Topic={Topic}, GroupId={GroupId}",
                            _kafka.Topic, _kafka.GroupId);

                        consecutiveErrors = 0; // Reset licznika błędów
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex,
                            "Failed to create Kafka consumer. Will retry in {Backoff} seconds.",
                            backoff.TotalSeconds);
                        SafeClose();

                        consecutiveErrors++;
                        var delayTime = TimeSpan.FromSeconds(Math.Min(backoff.TotalSeconds * consecutiveErrors, 60));
                        await Task.Delay(delayTime, stoppingToken);
                        continue;
                    }
                }

                // Krótki poll - nie blokuje przerwania
                var cr = _consumer.Consume(TimeSpan.FromMilliseconds(500));

                if (cr is null)
                {
                    // Brak wiadomości - to normalne
                    continue;
                }

                if (cr.IsPartitionEOF)
                {
                    _logger.LogDebug("Reached EOF {TPO}", cr.TopicPartitionOffset);
                    continue;
                }

                _logger.LogInformation("Consumed message at {TPO}", cr.TopicPartitionOffset);

                // Deserializacja
                var dto = JsonSerializer.Deserialize<OrderDto>(cr.Message.Value);
                if (dto is null)
                {
                    _logger.LogWarning("Cannot deserialize message: {Payload}", cr.Message.Value);
                    continue;
                }

                // Wysłanie notyfikacji
                await _notifier.NotifyAsync(dto);
                _logger.LogInformation("Notification sent for order {OrderId}", dto.Id);

                consecutiveErrors = 0; // Reset po sukcesie
            }
            catch (ConsumeException cex)
            {
                _logger.LogWarning(cex, "Consume error: {Reason}", cex.Error.Reason);
                consecutiveErrors++;

                // Jeśli błąd jest poważny, zamknij konsumera
                if (cex.Error.IsFatal)
                {
                    _logger.LogError("Fatal consume error, recreating consumer");
                    SafeClose();
                }

                await Task.Delay(backoff, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // Normalne zamykanie serwisu
                _logger.LogInformation("Consumer loop cancelled - application is shutting down");
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Unexpected error in consumer loop. Will recreate consumer after delay.");
                SafeClose();

                consecutiveErrors++;
                var delayTime = TimeSpan.FromSeconds(Math.Min(backoff.TotalSeconds * consecutiveErrors, 60));
                await Task.Delay(delayTime, stoppingToken);
            }
        }

        _logger.LogInformation("OrderPlacedConsumer loop stopped");
    }

    public override Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("OrderPlacedConsumer StopAsync() called");
        SafeClose();
        return base.StopAsync(cancellationToken);
    }

    private void SafeClose()
    {
        if (_consumer is null) return;

        try
        {
            _logger.LogDebug("Closing Kafka consumer...");
            _consumer.Close();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error closing consumer");
        }

        try
        {
            _consumer.Dispose();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error disposing consumer");
        }

        _consumer = null;
    }
}