# apps-product.tf
resource "kubernetes_service_v1" "product" {
  metadata {
    name      = var.production_app_name
    namespace = var.namespace
  }
  spec {
    selector = { app = var.production_app_name }
    port {
      port        = 80
      target_port = 80
    }
  }
  depends_on = [kubernetes_deployment_v1.mongo]
}

resource "kubernetes_deployment_v1" "product" {
  metadata {
    name      = var.production_app_name
    namespace = var.namespace
  }
  spec {
    replicas = 1
    selector { match_labels = { app = var.production_app_name } }
    template {
      metadata { labels = { app = var.production_app_name } }
      spec {
        container {
          name              = var.production_app_name
          image             = var.image_productservice
          image_pull_policy = "Never"
          env_from {
            config_map_ref { name = kubernetes_config_map_v1.product_cfg.metadata[0].name }
          }
          env {
            name  = "ASPNETCORE_URLS"
            value = "http://+:80"
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
  depends_on = [kubernetes_service_v1.product]
}
