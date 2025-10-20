# monitoring-grafana.tf

# ConfigMap z konfiguracją datasource dla Grafany
resource "kubernetes_config_map_v1" "grafana_datasources" {
  metadata {
    name      = "grafana-datasources"
    namespace = var.namespace
  }

  data = {
    "prometheus.yml" = <<-EOF
      apiVersion: 1
      datasources:
        - name: Prometheus
          type: prometheus
          access: proxy
          url: http://prometheus:9090
          isDefault: true
          editable: true
    EOF
  }

  depends_on = [kubernetes_namespace_v1.ns]
}

# ConfigMap z przykładowym dashboardem
resource "kubernetes_config_map_v1" "grafana_dashboards" {
  metadata {
    name      = "grafana-dashboards"
    namespace = var.namespace
  }

  data = {
    "dashboard-provider.yml" = <<-EOF
      apiVersion: 1
      providers:
        - name: 'default'
          orgId: 1
          folder: ''
          type: file
          disableDeletion: false
          updateIntervalSeconds: 10
          allowUiUpdates: true
          options:
            path: /var/lib/grafana/dashboards
    EOF

    "microservices-dashboard.json" = <<-EOF
      {
        "dashboard": {
          "title": "Microservices Overview",
          "tags": ["microservices", "dotnet"],
          "timezone": "browser",
          "schemaVersion": 16,
          "version": 0,
          "refresh": "5s",
          "panels": [
            {
              "id": 1,
              "type": "graph",
              "title": "HTTP Request Rate",
              "targets": [
                {
                  "expr": "rate(http_requests_received_total[5m])",
                  "legendFormat": "{{job}} - {{method}}"
                }
              ],
              "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}
            },
            {
              "id": 2,
              "type": "graph",
              "title": "HTTP Request Duration",
              "targets": [
                {
                  "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
                  "legendFormat": "{{job}} - p95"
                }
              ],
              "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0}
            },
            {
              "id": 3,
              "type": "stat",
              "title": "Services Health",
              "targets": [
                {
                  "expr": "up{job=~\"userservice|productservice|orderservice|notificationservice|apigateway\"}",
                  "legendFormat": "{{job}}"
                }
              ],
              "gridPos": {"h": 6, "w": 24, "x": 0, "y": 8}
            },
            {
              "id": 4,
              "type": "graph",
              "title": "Memory Usage",
              "targets": [
                {
                  "expr": "process_working_set_bytes / 1024 / 1024",
                  "legendFormat": "{{job}} - MB"
                }
              ],
              "gridPos": {"h": 8, "w": 12, "x": 0, "y": 14}
            },
            {
              "id": 5,
              "type": "graph",
              "title": "CPU Usage",
              "targets": [
                {
                  "expr": "rate(process_cpu_seconds_total[5m]) * 100",
                  "legendFormat": "{{job}} - %"
                }
              ],
              "gridPos": {"h": 8, "w": 12, "x": 12, "y": 14}
            }
          ]
        }
      }
    EOF
  }

  depends_on = [kubernetes_namespace_v1.ns]
}

# Secret dla Grafany (admin credentials)
resource "kubernetes_secret_v1" "grafana" {
  metadata {
    name      = "grafana-credentials"
    namespace = var.namespace
  }

  type = "Opaque"

  data = {
    "admin-user"     = var.grafana_admin_user
    "admin-password" = var.grafana_admin_password
  }

  depends_on = [kubernetes_namespace_v1.ns]
}

# PersistentVolumeClaim dla Grafany
resource "kubernetes_persistent_volume_claim_v1" "grafana" {
  metadata {
    name      = "grafana-pvc"
    namespace = var.namespace
  }

  spec {
    access_modes = ["ReadWriteOnce"]
    resources {
      requests = {
        storage = "5Gi"
      }
    }
  }

  depends_on = [kubernetes_namespace_v1.ns]
}

# Deployment Grafany
resource "kubernetes_deployment_v1" "grafana" {
  metadata {
    name      = "grafana"
    namespace = var.namespace
    labels = {
      app = "grafana"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "grafana"
      }
    }

    template {
      metadata {
        labels = {
          app = "grafana"
        }
      }

      spec {
        container {
          name  = "grafana"
          image = "grafana/grafana:10.2.2"

          port {
            container_port = 3000
            name           = "http"
          }

          env {
            name = "GF_SECURITY_ADMIN_USER"
            value_from {
              secret_key_ref {
                name = kubernetes_secret_v1.grafana.metadata[0].name
                key  = "admin-user"
              }
            }
          }

          env {
            name = "GF_SECURITY_ADMIN_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret_v1.grafana.metadata[0].name
                key  = "admin-password"
              }
            }
          }

          env {
            name  = "GF_INSTALL_PLUGINS"
            value = ""
          }

          env {
            name  = "GF_SERVER_ROOT_URL"
            value = "http://localhost:3000"
          }

          volume_mount {
            name       = "grafana-storage"
            mount_path = "/var/lib/grafana"
          }

          volume_mount {
            name       = "grafana-datasources"
            mount_path = "/etc/grafana/provisioning/datasources"
          }

          volume_mount {
            name       = "grafana-dashboards-config"
            mount_path = "/etc/grafana/provisioning/dashboards"
          }

          volume_mount {
            name       = "grafana-dashboards"
            mount_path = "/var/lib/grafana/dashboards"
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "256Mi"
            }
            limits = {
              cpu    = "200m"
              memory = "512Mi"
            }
          }

          liveness_probe {
            http_get {
              path = "/api/health"
              port = 3000
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }

          readiness_probe {
            http_get {
              path = "/api/health"
              port = 3000
            }
            initial_delay_seconds = 5
            period_seconds        = 10
          }
        }

        volume {
          name = "grafana-storage"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim_v1.grafana.metadata[0].name
          }
        }

        volume {
          name = "grafana-datasources"
          config_map {
            name = kubernetes_config_map_v1.grafana_datasources.metadata[0].name
          }
        }

        volume {
          name = "grafana-dashboards-config"
          config_map {
            name = kubernetes_config_map_v1.grafana_dashboards.metadata[0].name
            items {
              key  = "dashboard-provider.yml"
              path = "dashboard-provider.yml"
            }
          }
        }

        volume {
          name = "grafana-dashboards"
          config_map {
            name = kubernetes_config_map_v1.grafana_dashboards.metadata[0].name
            items {
              key  = "microservices-dashboard.json"
              path = "microservices-dashboard.json"
            }
          }
        }
      }
    }
  }

  depends_on = [
    kubernetes_config_map_v1.grafana_datasources,
    kubernetes_config_map_v1.grafana_dashboards,
    kubernetes_secret_v1.grafana
  ]
}

# Service dla Grafany
resource "kubernetes_service_v1" "grafana" {
  metadata {
    name      = "grafana"
    namespace = var.namespace
    labels = {
      app = "grafana"
    }
  }

  spec {
    type = "NodePort"

    selector = {
      app = "grafana"
    }

    port {
      name        = "http"
      port        = 3000
      target_port = 3000
      node_port   = 30300
    }
  }

  depends_on = [kubernetes_deployment_v1.grafana]
}
