locals {
  # Select configuration based on scaling_scenario variable
  selected_scenario = (
    var.scaling_type == "small" ? var.scenario_small :
    var.scaling_type == "medium" ? var.scenario_medium :
    var.scaling_type == "large" ? var.scenario_large :
    var.scenario_small # fallback to baseline
  )
}


resource "kubernetes_service_v1" "order" {
  metadata {
    name      = "orderservice"
    namespace = var.namespace
    annotations = {
      "scaling-test/scenario"    = var.scaling_type
      "scaling-test/replicas"    = tostring(local.selected_scenario.replicas)
      "scaling-test/cpu-request" = local.selected_scenario.cpu_request
      "scaling-test/cpu-limit"   = local.selected_scenario.cpu_limit
      "scaling-test/mem-request" = local.selected_scenario.mem_request
      "scaling-test/mem-limit"   = local.selected_scenario.mem_limit
      "prometheus.io/scrape"     = "true"
      "prometheus.io/port"       = "80"       # <-- port, na którym /metrics słucha
      "prometheus.io/path"       = "/metrics" # <-- ścieżka metryk
    }
  }
  spec {
    selector = { app = "orderservice" }
    port {
      port        = 80
      target_port = 80
    }
  }

  depends_on = [kubernetes_deployment_v1.redpanda, kubernetes_deployment_v1.postgres_order]
}

resource "kubernetes_deployment_v1" "order" {
  metadata {
    name      = "orderservice"
    namespace = var.namespace
  }
  spec {
    replicas = 1
    selector { match_labels = { app = "orderservice" } }
    template {
      metadata { labels = { app = "orderservice" } }
      spec {
        container {
          name              = "orderservice"
          image             = var.image_orderservice
          image_pull_policy = "IfNotPresent"

          resources {
            requests = {
              cpu    = local.selected_scenario.cpu_request
              memory = local.selected_scenario.mem_request
            }
            limits = {
              cpu    = local.selected_scenario.cpu_limit
              memory = local.selected_scenario.mem_limit
            }
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map_v1.order_cfg.metadata[0].name
            }
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
            name  = "KafkaSettings__BootstrapServers"
            value = "redpanda:9092"
          }
          env {
            name  = "KafkaSettings__Topic"
            value = "orders"
          }
          env {
            name  = "KafkaSettings__Partitions"
            value = "3"
          }
          env {
            name  = "KafkaSettings__ReplicationFactor"
            value = "1"
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
  depends_on = [kubernetes_service_v1.order]
}


# Output current scenario configuration
output "scaling_scenario_deployed" {
  value = {
    scenario    = var.scaling_type
    replicas    = local.selected_scenario.replicas
    cpu_request = local.selected_scenario.cpu_request
    cpu_limit   = local.selected_scenario.cpu_limit
    mem_request = local.selected_scenario.mem_request
    mem_limit   = local.selected_scenario.mem_limit
  }
  description = "Currently deployed scenario configuration"
}
