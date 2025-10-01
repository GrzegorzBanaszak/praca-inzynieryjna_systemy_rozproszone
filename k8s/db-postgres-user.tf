
resource "kubernetes_service_v1" "postgres_user" {
  metadata {
    name      = "postgres"
    namespace = var.namespace
  }
  spec {
    selector = { app = "postgres" }
    port {
      port        = 5432
      target_port = 5432
    }
  }
}

resource "kubernetes_deployment_v1" "postgres_user" {
  metadata {
    name      = "postgres"
    namespace = var.namespace
  }
  spec {
    replicas = 1
    selector { match_labels = { app = "postgres" } }
    template {
      metadata { labels = { app = "postgres" } }
      spec {
        container {
          name  = "postgres"
          image = "postgres:15"
          env {
            name  = "POSTGRES_USER"
            value = var.pg_user
          }
          env {
            name  = "POSTGRES_PASSWORD"
            value = var.pg_password
          }
          env {
            name  = "POSTGRES_DB"
            value = "UserDb"
          }
          port { container_port = 5432 }
          readiness_probe {
            exec { command = ["pg_isready", "-U", var.pg_user] }
            initial_delay_seconds = 10
            period_seconds        = 10
          }
        }
      }
    }
  }
}
