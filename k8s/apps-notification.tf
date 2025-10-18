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
  depends_on = [kubernetes_deployment_v1.order]
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
          image_pull_policy = "Never"
          env {
            name  = "KafkaSettings__BootstrapServers"
            value = "redpanda:9092"
          }
          env {
            name  = "KafkaSettings__Topic"
            value = "orders"
          }
          env {
            name  = "KafkaSettings__GroupId"
            value = "notification-service-group"
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
  depends_on = [kubernetes_service_v1.notification]
}
