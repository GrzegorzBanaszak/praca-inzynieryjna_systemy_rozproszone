# apps-product-scaling.tf
# ProductService deployment with configurable resources for scaling tests
# This file replaces apps-product.tf when running scaling tests

locals {
  # Select configuration based on scaling_scenario variable
  selected_config = (
    var.scaling_scenario == "baseline" ? var.scenario_baseline :
    var.scaling_scenario == "horizontal" ? var.scenario_horizontal :
    var.scaling_scenario == "vertical" ? var.scenario_vertical :
    var.scaling_scenario == "hpa" ? var.scenario_hpa :
    var.scenario_baseline # fallback to baseline
  )
}

resource "kubernetes_service_v1" "product_scaling" {
  metadata {
    name      = var.production_app_name
    namespace = var.namespace
    labels = {
      app              = var.production_app_name
      scaling-scenario = var.scaling_scenario
    }
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

resource "kubernetes_deployment_v1" "product_scaling" {
  metadata {
    name      = var.production_app_name
    namespace = var.namespace
    labels = {
      app              = var.production_app_name
      scaling-scenario = var.scaling_scenario
    }
    annotations = {
      "scaling-test/scenario"    = var.scaling_scenario
      "scaling-test/replicas"    = tostring(local.selected_config.replicas)
      "scaling-test/cpu-request" = local.selected_config.cpu_request
      "scaling-test/cpu-limit"   = local.selected_config.cpu_limit
      "scaling-test/mem-request" = local.selected_config.mem_request
      "scaling-test/mem-limit"   = local.selected_config.mem_limit
      "prometheus.io/scrape"     = "true"
      "prometheus.io/port"       = "80"       # <-- port, na którym /metrics słucha
      "prometheus.io/path"       = "/metrics" # <-- ścieżka metryk
    }
  }
  spec {
    replicas = local.selected_config.replicas

    selector {
      match_labels = {
        app = var.production_app_name
      }
    }

    template {
      metadata {
        labels = {
          app              = var.production_app_name
          scaling-scenario = var.scaling_scenario
        }
      }

      spec {
        container {
          name              = var.production_app_name
          image             = var.image_productservice
          image_pull_policy = "Never"

          # Resource configuration - the heart of our scaling tests
          resources {
            requests = {
              cpu    = local.selected_config.cpu_request
              memory = local.selected_config.mem_request
            }
            limits = {
              cpu    = local.selected_config.cpu_limit
              memory = local.selected_config.mem_limit
            }
          }
          env {
            name  = "ASPNETCORE_HTTP_PROTOCOLS"
            value = "Http1AndHttp2"
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map_v1.product_cfg.metadata[0].name
            }
          }

          env {
            name  = "ASPNETCORE_URLS"
            value = "http://+:80"
          }

          # Add environment variable to identify which scenario is running
          env {
            name  = "SCALING_SCENARIO"
            value = var.scaling_scenario
          }

          port {
            container_port = 80
          }

          # Readiness probe - critical for HPA and rolling updates
          readiness_probe {
            http_get {
              path = "/healthz"
              port = 80
            }
            initial_delay_seconds = 10
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          # Liveness probe - restart unhealthy pods
          liveness_probe {
            http_get {
              path = "/healthz"
              port = 80
            }
            initial_delay_seconds = 30
            period_seconds        = 20
            timeout_seconds       = 5
            failure_threshold     = 3
          }
        }
      }
    }
  }
  depends_on = [kubernetes_service_v1.product_scaling]

  # Lifecycle management to prevent destroying during scenario switches
  lifecycle {
    create_before_destroy = true
  }
}

# Output current scenario configuration
output "scaling_scenario_deployed" {
  value = {
    scenario    = var.scaling_scenario
    replicas    = local.selected_config.replicas
    cpu_request = local.selected_config.cpu_request
    cpu_limit   = local.selected_config.cpu_limit
    mem_request = local.selected_config.mem_request
    mem_limit   = local.selected_config.mem_limit
    hpa_enabled = var.hpa_enabled
  }
  description = "Currently deployed scaling scenario configuration"
}
