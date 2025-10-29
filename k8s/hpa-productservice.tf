# hpa-productservice.tf
# Horizontal Pod Autoscaler configuration for Scenario 4 (Auto-scaling test)
# This resource automatically scales ProductService based on CPU utilization

resource "kubernetes_horizontal_pod_autoscaler_v2" "productservice_hpa" {
  # Only create this resource when HPA is enabled (scenario 4)
  count = var.hpa_enabled ? 1 : 0

  metadata {
    name      = "productservice-hpa"
    namespace = var.namespace
    labels = {
      app              = "productservice"
      scaling-scenario = "hpa"
    }
    annotations = {
      "description" = "Auto-scales ProductService from 1 to 5 pods based on CPU load"
      "test-phase"  = "scaling-scenario-4"
    }
  }

  spec {
    # Define which deployment to scale
    scale_target_ref {
      api_version = "apps/v1"
      kind        = "Deployment"
      name        = kubernetes_deployment_v1.product_scaling.metadata[0].name
    }

    # Minimum and maximum number of replicas
    # HPA will never scale below min or above max
    min_replicas = var.hpa_min_replicas # Default: 1
    max_replicas = var.hpa_max_replicas # Default: 5

    # Metrics to monitor for scaling decisions
    metric {
      type = "Resource"
      resource {
        name = "cpu"
        target {
          type                = "Utilization"
          average_utilization = var.hpa_target_cpu_utilization # Default: 70%
        }
      }
    }

    # Optional: Memory-based scaling (commented out, but available)
    # metric {
    #   type = "Resource"
    #   resource {
    #     name = "memory"
    #     target {
    #       type                = "Utilization"
    #       average_utilization = 80
    #     }
    #   }
    # }

    # Scaling behavior configuration
    behavior {
      # Scale-up behavior (when load increases)
      scale_up {
        # Stabilization window: wait before scaling up again
        stabilization_window_seconds = 0 # Scale up immediately when needed
        
        # Scaling policies
        policy {
          type           = "Percent"
          value          = 100 # Double the number of pods
          period_seconds = 15  # Every 15 seconds
        }
        
        policy {
          type           = "Pods"
          value          = 2   # Or add 2 pods
          period_seconds = 15
        }
        
        # Use the policy that adds more pods
        select_policy = "Max"
      }

      # Scale-down behavior (when load decreases)
      scale_down {
        # Stabilization window: wait 5 minutes before scaling down
        # This prevents flapping (rapid scale-up and scale-down cycles)
        stabilization_window_seconds = 300 # 5 minutes

        # Scaling policies
        policy {
          type           = "Percent"
          value          = 50  # Remove up to 50% of pods
          period_seconds = 60  # Every minute
        }

        policy {
          type           = "Pods"
          value          = 1   # Or remove 1 pod
          period_seconds = 60
        }

        # Use the policy that removes fewer pods (more conservative)
        select_policy = "Min"
      }
    }
  }
}

# Output HPA status
output "hpa_configuration" {
  value = var.hpa_enabled ? {
    enabled               = true
    min_replicas          = var.hpa_min_replicas
    max_replicas          = var.hpa_max_replicas
    target_cpu            = "${var.hpa_target_cpu_utilization}%"
    scale_up_policy       = "Aggressive (immediate, +100% or +2 pods)"
    scale_down_policy     = "Conservative (5 min wait, -50% or -1 pod)"
    scale_down_delay      = "5 minutes (prevents flapping)"
    expected_behavior     = "Should scale from 1 to 5 pods as load increases"
    monitoring_command    = "kubectl get hpa -n distributed-system -w"
    description           = "HPA will automatically adjust pod count based on CPU load"
  } : {
    enabled     = false
    description = "HPA is disabled. Set var.hpa_enabled=true to enable."
  }
  description = "HPA configuration details and monitoring instructions"
}
