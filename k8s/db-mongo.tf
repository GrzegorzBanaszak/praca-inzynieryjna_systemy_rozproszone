# db-mongo.tf
resource "kubernetes_service_v1" "mongo" {
  metadata {
    name      = "mongo"
    namespace = var.namespace
  }
  spec {
    selector = { app = "mongo" }
    port {
      port        = 27017
      target_port = 27017
    }
  }
}

resource "kubernetes_deployment_v1" "mongo" {
  metadata {
    name      = "mongo"
    namespace = var.namespace
  }
  spec {
    replicas = 1
    selector { match_labels = { app = "mongo" } }
    template {
      metadata { labels = { app = "mongo" } }
      spec {
        container {
          name  = "mongo"
          image = "mongo:6.0"
          port { container_port = 27017 }
          readiness_probe {
            exec { command = ["mongosh", "--quiet", "--eval", "db.adminCommand('ping')"] }
            initial_delay_seconds = 10
            period_seconds        = 10
          }
        }
      }
    }
  }
}
