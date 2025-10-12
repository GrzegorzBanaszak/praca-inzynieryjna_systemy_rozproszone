# apps-product.tf
resource "kubernetes_service_v1" "product" {
  metadata {
    name      = "productservice"
    namespace = var.namespace
  }
  spec {
    selector = { app = "productservice" }
    port {
      port        = 80
      target_port = 80
    }
  }
}

resource "kubernetes_deployment_v1" "product" {
  metadata {
    name      = "productservice"
    namespace = var.namespace
  }
  spec {
    replicas = 1
    selector { match_labels = { app = "productservice" } }
    template {
      metadata { labels = { app = "productservice" } }
      spec {
        container {
          name              = "productservice"
          image             = var.image_productservice
          image_pull_policy = "IfNotPresent"
          env_from {
            config_map_ref { name = kubernetes_config_map_v1.product_cfg.metadata[0].name }
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
