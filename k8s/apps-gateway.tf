# apps-gateway.tf
resource "kubernetes_service_v1" "apigateway" {
  metadata {
    name      = "apigateway"
    namespace = var.namespace
  }
  spec {
    selector = { app = "apigateway" }
    port {
      port        = 80
      target_port = 80
    }
  }
  depends_on = [kubernetes_namespace_v1.ns]
}

resource "kubernetes_deployment_v1" "apigateway" {
  metadata {
    name      = "apigateway"
    namespace = var.namespace
  }
  spec {
    replicas = 1
    selector { match_labels = { app = "apigateway" } }
    template {
      metadata { labels = { app = "apigateway" } }
      spec {
        container {
          name              = "apigateway"
          image             = var.image_apigatewayservice
          image_pull_policy = "Never"
          env_from {
            secret_ref { name = kubernetes_secret_v1.jwt.metadata[0].name }
          }
          env {
            name  = "ASPNETCORE_URLS"
            value = "http://+:80"
          }
          env {
            name  = "ASPNETCORE_HTTP_PROTOCOLS"
            value = "Http2"
          }
          env {
            name  = "AppContext__System.Net.Http.SocketsHttpHandler.Http2UnencryptedSupport"
            value = "true"
          }
          port { container_port = 80 }
          # readiness_probe {
          #   http_get {
          #     path = "/healthz"
          #     port = 80
          #   }
          #   initial_delay_seconds = 10
          #   period_seconds        = 10
          # }
          resources {
            requests = {
              cpu    = "500m" # 0.5 CPU core
              memory = "512Mi"
            }
            limits = {
              cpu    = "1000m" # 1 CPU core
              memory = "1Gi"
            }
          }
        }
      }
    }
  }
  depends_on = [kubernetes_namespace_v1.ns]
}
