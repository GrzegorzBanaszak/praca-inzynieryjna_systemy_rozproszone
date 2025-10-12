# apps-user.tf
resource "kubernetes_service_v1" "user" {
  metadata {
    name      = "userservice"
    namespace = var.namespace
  }
  spec {
    selector = { app = "userservice" }
    port {
      port        = 80
      target_port = 80
    }
  }
}

resource "kubernetes_deployment_v1" "user" {
  metadata {
    name      = "userservice"
    namespace = var.namespace
  }
  spec {
    replicas = 1
    selector { match_labels = { app = "userservice" } }
    template {
      metadata { labels = { app = "userservice" } }
      spec {
        container {
          name              = "userservice"
          image             = var.image_userservice
          image_pull_policy = "IfNotPresent"
          env_from {
            config_map_ref { name = kubernetes_config_map_v1.user_cfg.metadata[0].name }
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
            name = "JwtSettings__Issuer"
            value_from {
              secret_key_ref {
                name = kubernetes_secret_v1.jwt.metadata[0].name
                key  = "Jwt__Issuer"
              }
            }
          }
          env {
            name = "JwtSettings__Audience"
            value_from {
              secret_key_ref {
                name = kubernetes_secret_v1.jwt.metadata[0].name
                key  = "Jwt__Audience"
              }
            }
          }
          env {
            name = "JwtSettings__ExpiresInMinutes"
            value_from {
              secret_key_ref {
                name = kubernetes_secret_v1.jwt.metadata[0].name
                key  = "Jwt__ExpiresInMinutes"
              }
            }
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
