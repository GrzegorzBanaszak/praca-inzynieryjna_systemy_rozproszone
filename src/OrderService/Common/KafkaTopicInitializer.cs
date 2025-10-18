using Confluent.Kafka;
using Confluent.Kafka.Admin;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using OrderService.Settings; // gdzie masz KafkaSettings

namespace OrderService.Common;

public class KafkaTopicInitializer : IHostedService
{
    private readonly IAdminClient _admin;
    private readonly IOptions<KafkaSettings> _opts;
    private readonly ILogger<KafkaTopicInitializer> _log;

    public KafkaTopicInitializer(IAdminClient admin, IOptions<KafkaSettings> opts, ILogger<KafkaTopicInitializer> log)
    {
        _admin = admin; _opts = opts; _log = log;
    }

    public async Task StartAsync(CancellationToken ct)
    {
        var topic = _opts.Value.Topic;
        var partitions = _opts.Value.Partitions ?? 3;  // dodaj do ustawień, patrz niżej
        short repl = (short)(_opts.Value.ReplicationFactor ?? 1); // Redpanda/Kafka single-node => 1

        try
        {
            // Czy topic już istnieje?
            var md = _admin.GetMetadata(topic, TimeSpan.FromSeconds(5));
            var exists = md.Topics.Any(t => t.Topic == topic && t.Error.Code == ErrorCode.NoError);
            if (exists)
            {
                _log.LogInformation("Kafka topic {Topic} already exists.", topic);
                return;
            }

            _log.LogInformation("Creating Kafka topic {Topic} (p={P}, rf={RF})…", topic, partitions, repl);
            await _admin.CreateTopicsAsync(new[]
            {
                new TopicSpecification { Name = topic, NumPartitions = partitions, ReplicationFactor = repl }
            });

            _log.LogInformation("Kafka topic {Topic} created.", topic);
        }
        catch (CreateTopicsException ex) when (ex.Results.Any(r => r.Error.Code == ErrorCode.TopicAlreadyExists))
        {
            _log.LogInformation("Kafka topic {Topic} already exists.", topic);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Failed to ensure Kafka topic {Topic}.", topic);
        }
    }

    public Task StopAsync(CancellationToken ct) => Task.CompletedTask;
}