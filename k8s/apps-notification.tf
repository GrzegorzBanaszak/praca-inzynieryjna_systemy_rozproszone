# apps-notification.tf
resource "kubernetes_service_v1" "notification" {
  metadata {
    name      = "notificationservice"
    namespace = var.namespace
  }
  spec {
    selector = { app = "notificationservice" }
    port {
      port        = 80
      target_port = 80
    }
  }
}

resource "kubernetes_deployment_v1" "notification" {
  metadata {
    name      = "notificationservice"
    namespace = var.namespace
  }
  spec {
    replicas = 1
    selector { match_labels = { app = "notificationservice" } }
    template {
      metadata { labels = { app = "notificationservice" } }
      spec {
        container {
          name              = "notificationservice"
          image             = var.image_notificationservice
          image_pull_policy = "IfNotPresent"
          env {
            name  = "KafkaSettings__BootstrapServers"
            value = "kafka:9092"
          }
          env {
            name  = "KafkaSettings__Topic"
            value = "orders"
          }
          env {
            name  = "KafkaSettings__GroupId"
            value = "notification-service-group"
          }
          port { container_port = 80 }
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
}
