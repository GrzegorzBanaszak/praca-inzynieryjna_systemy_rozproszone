resource "kubernetes_service_v1" "redpanda" {
  metadata {
    name      = "redpanda"
    namespace = var.namespace
    labels    = { app = "redpanda" }
  }
  spec {
    selector = { app = "redpanda" }
    type     = "ClusterIP"
    port {
      name        = "kafka"
      port        = 9092
      target_port = 9092
    } # Kafka API
    port {
      name        = "admin"
      port        = 9644
      target_port = 9644
    } # Admin HTTP
  }
}

resource "kubernetes_deployment_v1" "redpanda" {
  metadata {
    name      = "redpanda"
    namespace = var.namespace
    labels    = { app = "redpanda" }
  }
  spec {
    replicas = 1
    selector { match_labels = { app = "redpanda" } }
    template {
      metadata { labels = { app = "redpanda" } }
      spec {
        container {
          name              = "redpanda"
          image             = "redpandadata/redpanda:latest"
          image_pull_policy = "IfNotPresent"
          args = [
            "redpanda", "start",
            "--overprovisioned",
            "--smp=1",
            "--memory=1G",
            "--reserve-memory=0M",
            "--node-id=0",
            "--check=false",
            "--advertise-kafka-addr=redpanda:9092",
            "--set", "redpanda.auto_create_topics_enabled=true"
          ]
          port { container_port = 9092 }
          port { container_port = 9644 }
          readiness_probe {
            http_get {
              path = "/v1/status/ready"
              port = 9644
            }
            initial_delay_seconds = 5
            period_seconds        = 10
          }
          liveness_probe {
            http_get {
              path = "/v1/status/ready"
              port = 9644
            }
            initial_delay_seconds = 15
            period_seconds        = 20
          }
          volume_mount {
            name       = "data"
            mount_path = "/var/lib/redpanda/data"
          }
        }
        volume {
          name = "data"
          empty_dir {}
        }
      }
    }
  }
}
