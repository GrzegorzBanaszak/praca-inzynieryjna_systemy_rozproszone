resource "kubernetes_config_map_v1" "grafana_scaling_dashboard" {
  metadata {
    name      = "grafana-scaling-dashboard"
    namespace = var.namespace
    labels = {
      grafana_dashboard = "1"
    }
  }

  data = {
    "scaling-tests-with-limits.json" = file("${path.module}/dashboards/scaling-tests-with-limits.json")
  }

  depends_on = [kubernetes_deployment_v1.grafana]
}
