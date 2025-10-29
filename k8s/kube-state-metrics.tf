variable "ksm_chart_version" {
  type = string
  # dostosuj w razie potrzeby
  default = "6.3.0"
}

# Instalacja KSM z oficjalnego chartu
resource "helm_release" "kube_state_metrics" {
  name      = "kube-state-metrics"
  namespace = var.namespace

  # możesz użyć też OCI: oci://ghcr.io/prometheus-community/charts
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-state-metrics"
  version    = var.ksm_chart_version

  # rozsądne zasoby (dostosuj wg klastra)
  set {
    name  = "replicas"
    value = "1"
  }
  set {
    name  = "resources.limits.cpu"
    value = "200m"
  }
  set {
    name  = "resources.limits.memory"
    value = "300Mi"
  }
  set {
    name  = "resources.requests.cpu"
    value = "100m"
  }
  set {
    name  = "resources.requests.memory"
    value = "250Mi"
  }
}

#############################################
# Integracja z Prometheusem – wybierz tryb
#############################################

# 1) Jeśli masz Prometheus Operator: włącz i ustaw label release
variable "use_prometheus_operator" {
  type    = bool
  default = false
}

# label z którego korzysta Twój Prometheus Operator do wybierania ServiceMonitorów
variable "prometheus_release_label" {
  type    = string
  default = "prometheus"
}

resource "kubernetes_manifest" "ksm_servicemonitor" {
  count = var.use_prometheus_operator ? 1 : 0
  manifest = {
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "ServiceMonitor"
    metadata = {
      name      = "kube-state-metrics"
      namespace = var.namespace
      labels = {
        # dopasuj do .spec.selector.matchLabels Twojego Prometheusa
        release = "prometheus"
      }
    }
    spec = {
      namespaceSelector = { matchNames = [var.namespace] }
      selector = {
        matchLabels = {
          "app.kubernetes.io/name" = "kube-state-metrics"
        }
      }
      endpoints = [
        { port = "http-metrics", interval = "30s" }, # :8080 – metryki K8s
        { port = "telemetry", interval = "30s" }     # :8081 – metryki samego KSM
      ]
    }
  }
  depends_on = [kubernetes_deployment_v1.prometheus]
}
