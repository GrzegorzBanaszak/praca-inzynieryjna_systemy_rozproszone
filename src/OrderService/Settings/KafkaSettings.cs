namespace OrderService.Settings
{
    public class KafkaSettings
    {
        public string BootstrapServers { get; set; } = null!;
        public string Topic { get; set; } = null!;
        public int? Partitions { get; set; }          // opcjonalnie
        public int? ReplicationFactor { get; set; }   // opcjonalnie
    }
}
