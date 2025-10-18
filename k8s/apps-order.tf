# apps-order.tf
resource "kubernetes_service_v1" "order" {
  metadata {
    name      = "orderservice"
    namespace = var.namespace
  }
  spec {
    selector = { app = "orderservice" }
    port {
      port        = 80
      target_port = 80
    }
  }
  depends_on = [kubernetes_deployment_v1.redpanda, kubernetes_deployment_v1.postgres_order]
}

resource "kubernetes_deployment_v1" "order" {
  metadata {
    name      = "orderservice"
    namespace = var.namespace
  }
  spec {
    replicas = 1
    selector { match_labels = { app = "orderservice" } }
    template {
      metadata { labels = { app = "orderservice" } }
      spec {
        container {
          name              = "orderservice"
          image             = var.image_orderservice
          image_pull_policy = "IfNotPresent"
          env_from {
            config_map_ref {
              name = kubernetes_config_map_v1.order_cfg.metadata[0].name
            }
          }
          env {
            name = "JwtSettings__Key"
            value_from {
              secret_key_ref {
                name = kubernetes_secret_v1.jwt.metadata[0].name
                key  = "Jwt__Key"
              }
            }
          }
          env {
            name  = "KafkaSettings__BootstrapServers"
            value = "redpanda:9092"
          }
          env {
            name  = "KafkaSettings__Topic"
            value = "orders"
          }
          env {
            name  = "KafkaSettings__Partitions"
            value = "3"
          }
          env {
            name  = "KafkaSettings__ReplicationFactor"
            value = "1"
          }
          env {
            name  = "ASPNETCORE_URLS"
            value = "http://+:80"
          }
          port {
            container_port = 80
          }
          readiness_probe {
            http_get {
              path = "/healthz"
              port = 80
            }
            initial_delay_seconds = 10
            period_seconds        = 10
          }
        }
      }
    }
  }
  depends_on = [kubernetes_service_v1.order]
}
