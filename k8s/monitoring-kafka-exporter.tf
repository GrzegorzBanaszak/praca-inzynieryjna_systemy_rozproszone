resource "kubernetes_deployment_v1" "kafka_exporter" {
  metadata {
    name      = "kafka-exporter"
    namespace = var.namespace
    labels = {
      app = "kafka-exporter"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "kafka-exporter"
      }
    }

    template {
      metadata {
        labels = {
          app = "kafka-exporter"
        }
      }

      spec {
        container {
          name  = "kafka-exporter"
          image = "danielqsj/kafka-exporter:latest"

          args = [
            "--kafka.server=redpanda:9092",
            "--web.listen-address=:9308",
            "--topic.filter=orders.*",
          ]

          port {
            container_port = 9308
            name           = "metrics"
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "200m"
              memory = "256Mi"
            }
          }

          liveness_probe {
            http_get {
              path = "/metrics"
              port = 9308
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }

          readiness_probe {
            http_get {
              path = "/metrics"
              port = 9308
            }
            initial_delay_seconds = 5
            period_seconds        = 10
          }
        }
      }
    }
  }

  depends_on = [kubernetes_deployment_v1.redpanda]
}

resource "kubernetes_service_v1" "kafka_exporter" {
  metadata {
    name      = "kafka-exporter"
    namespace = var.namespace
    labels = {
      app = "kafka-exporter"
    }
    annotations = {
      "prometheus.io/scrape" = "true"
      "prometheus.io/port"   = "9308"
      "prometheus.io/path"   = "/metrics"
    }
  }

  spec {
    selector = {
      app = "kafka-exporter"
    }

    port {
      name        = "metrics"
      port        = 9308
      target_port = 9308
    }
  }

  depends_on = [kubernetes_deployment_v1.kafka_exporter]
}
