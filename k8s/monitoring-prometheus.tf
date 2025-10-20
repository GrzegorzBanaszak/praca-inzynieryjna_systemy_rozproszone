# monitoring-prometheus.tf

# ConfigMap z konfiguracją Prometheus
resource "kubernetes_config_map_v1" "prometheus_config" {
  metadata {
    name      = "prometheus-config"
    namespace = var.namespace
  }

  data = {
    "prometheus.yml" = <<-EOF
      global:
        scrape_interval: 15s
        evaluation_interval: 15s

      scrape_configs:
        # Prometheus itself
        - job_name: 'prometheus'
          static_configs:
            - targets: ['localhost:9090']

        # UserService
        - job_name: 'userservice'
          static_configs:
            - targets: ['userservice:80']
          metrics_path: '/metrics'

        # ProductService
        - job_name: 'productservice'
          static_configs:
            - targets: ['productservice:80']
          metrics_path: '/metrics'

        # OrderService
        - job_name: 'orderservice'
          static_configs:
            - targets: ['orderservice:80']
          metrics_path: '/metrics'

        # NotificationService
        - job_name: 'notificationservice'
          static_configs:
            - targets: ['notificationservice:80']
          metrics_path: '/metrics'

        # ApiGateway
        - job_name: 'apigateway'
          static_configs:
            - targets: ['apigateway:80']
          metrics_path: '/metrics'

        # Kubernetes API Server
        - job_name: 'kubernetes-apiservers'
          kubernetes_sd_configs:
            - role: endpoints
          scheme: https
          tls_config:
            ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
          bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
          relabel_configs:
            - source_labels: [__meta_kubernetes_namespace, __meta_kubernetes_service_name, __meta_kubernetes_endpoint_port_name]
              action: keep
              regex: default;kubernetes;https

        # Kubernetes nodes
        - job_name: 'kubernetes-nodes'
          kubernetes_sd_configs:
            - role: node
          scheme: https
          tls_config:
            ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
          bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
          relabel_configs:
            - action: labelmap
              regex: __meta_kubernetes_node_label_(.+)

        # Kubernetes pods
        - job_name: 'kubernetes-pods'
          kubernetes_sd_configs:
            - role: pod
          relabel_configs:
            - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
              action: keep
              regex: true
            - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
              action: replace
              target_label: __metrics_path__
              regex: (.+)
            - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
              action: replace
              regex: ([^:]+)(?::\d+)?;(\d+)
              replacement: $1:$2
              target_label: __address__
            - action: labelmap
              regex: __meta_kubernetes_pod_label_(.+)
            - source_labels: [__meta_kubernetes_namespace]
              action: replace
              target_label: kubernetes_namespace
            - source_labels: [__meta_kubernetes_pod_name]
              action: replace
              target_label: kubernetes_pod_name
    EOF
  }

  depends_on = [kubernetes_namespace_v1.ns]
}

# ServiceAccount dla Prometheus
resource "kubernetes_service_account_v1" "prometheus" {
  metadata {
    name      = "prometheus"
    namespace = var.namespace
  }

  depends_on = [kubernetes_namespace_v1.ns]
}

# ClusterRole dla Prometheus
resource "kubernetes_cluster_role_v1" "prometheus" {
  metadata {
    name = "prometheus"
  }

  rule {
    api_groups = [""]
    resources  = ["nodes", "nodes/proxy", "services", "endpoints", "pods"]
    verbs      = ["get", "list", "watch"]
  }

  rule {
    api_groups = ["extensions"]
    resources  = ["ingresses"]
    verbs      = ["get", "list", "watch"]
  }

  rule {
    api_groups = [""]
    resources  = ["configmaps"]
    verbs      = ["get"]
  }
}

# ClusterRoleBinding dla Prometheus
resource "kubernetes_cluster_role_binding_v1" "prometheus" {
  metadata {
    name = "prometheus"
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role_v1.prometheus.metadata[0].name
  }

  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account_v1.prometheus.metadata[0].name
    namespace = var.namespace
  }
}

# PersistentVolumeClaim dla Prometheus
resource "kubernetes_persistent_volume_claim_v1" "prometheus" {
  metadata {
    name      = "prometheus-pvc"
    namespace = var.namespace
  }

  spec {
    access_modes = ["ReadWriteOnce"]
    resources {
      requests = {
        storage = "10Gi"
      }
    }
  }

  depends_on = [kubernetes_namespace_v1.ns]
}

# Deployment Prometheus
resource "kubernetes_deployment_v1" "prometheus" {
  metadata {
    name      = "prometheus"
    namespace = var.namespace
    labels = {
      app = "prometheus"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "prometheus"
      }
    }

    template {
      metadata {
        labels = {
          app = "prometheus"
        }
      }

      spec {
        service_account_name = kubernetes_service_account_v1.prometheus.metadata[0].name

        container {
          name  = "prometheus"
          image = "prom/prometheus:v2.48.0"

          args = [
            "--config.file=/etc/prometheus/prometheus.yml",
            "--storage.tsdb.path=/prometheus",
            "--web.console.libraries=/usr/share/prometheus/console_libraries",
            "--web.console.templates=/usr/share/prometheus/consoles",
            "--web.enable-lifecycle"
          ]

          port {
            container_port = 9090
            name           = "web"
          }

          volume_mount {
            name       = "prometheus-config"
            mount_path = "/etc/prometheus"
          }

          volume_mount {
            name       = "prometheus-storage"
            mount_path = "/prometheus"
          }

          resources {
            requests = {
              cpu    = "200m"
              memory = "512Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "1Gi"
            }
          }

          liveness_probe {
            http_get {
              path = "/-/healthy"
              port = 9090
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }

          readiness_probe {
            http_get {
              path = "/-/ready"
              port = 9090
            }
            initial_delay_seconds = 5
            period_seconds        = 10
          }
        }

        volume {
          name = "prometheus-config"
          config_map {
            name = kubernetes_config_map_v1.prometheus_config.metadata[0].name
          }
        }

        volume {
          name = "prometheus-storage"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim_v1.prometheus.metadata[0].name
          }
        }
      }
    }
  }

  depends_on = [
    kubernetes_config_map_v1.prometheus_config,
    kubernetes_service_account_v1.prometheus,
    kubernetes_cluster_role_binding_v1.prometheus
  ]
}

# Service dla Prometheus
resource "kubernetes_service_v1" "prometheus" {
  metadata {
    name      = "prometheus"
    namespace = var.namespace
    labels = {
      app = "prometheus"
    }
  }

  spec {
    type = "NodePort"

    selector = {
      app = "prometheus"
    }

    port {
      name        = "web"
      port        = 9090
      target_port = 9090
      node_port   = 30090
    }
  }

  depends_on = [kubernetes_deployment_v1.prometheus]
}
