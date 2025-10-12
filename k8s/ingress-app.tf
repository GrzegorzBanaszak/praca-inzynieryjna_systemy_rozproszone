# ingress-app.tf
resource "kubernetes_ingress_v1" "ing" {
  metadata {
    name      = "apigateway-ingress"
    namespace = var.namespace
    annotations = {
      "kubernetes.io/ingress.class" = "nginx"
    }
  }
  spec {
    rule {
      host = var.host
      http {
        path {
          path      = "/"
          path_type = "Prefix"
          backend {
            service {
              name = kubernetes_service_v1.apigateway.metadata[0].name
              port { number = 80 }
            }
          }
        }
      }
    }
  }
}
