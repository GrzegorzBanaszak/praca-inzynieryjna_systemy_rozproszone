resource "kubernetes_config_map_v1" "grafana_k6_dashboard" {
  metadata {
    name      = "grafana-k6-dashboard"
    namespace = var.namespace
    labels = {
      grafana_dashboard = "1"
    }
  }

  data = {
    "k6-async-orders.json" = file("${path.module}/dashboards/k6-async-orders.json")
  }

  depends_on = [kubernetes_deployment_v1.grafana]
}
