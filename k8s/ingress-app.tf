# ingress-gateway.tf
resource "kubernetes_ingress_v1" "ing" {
  metadata {
    name      = "apigateway"
    namespace = var.namespace
    annotations = {
      # Jeśli używasz starszych manifestów/classic:
      "kubernetes.io/ingress.class" = "nginx"
      # (opcjonalnie) przykładowe tuningi NGINX:
      "nginx.ingress.kubernetes.io/backend-protocol"   = "GRPC"
      "nginx.ingress.kubernetes.io/proxy-read-timeout" = "60"
      "nginx.ingress.kubernetes.io/proxy-send-timeout" = "60"
    }
  }

  spec {
    # Nowocześniej – klasa ingressu:
    ingress_class_name = "nginx"

    rule {
      host = var.host
      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service_v1.apigateway.metadata[0].name
              port {
                number = 80
              }
            }
          }
        }
      }
    }

    # (opcjonalnie) TLS – jeśli chcesz własny cert w secrecie "apigateway-tls"
    # tls {
    #   hosts       = [var.apigateway_host]
    #   secret_name = "apigateway-tls"
    # }
  }

  depends_on = [kubernetes_service_v1.apigateway]
}
