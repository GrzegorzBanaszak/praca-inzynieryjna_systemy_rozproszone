# kafka.tf
resource "kubernetes_service_v1" "zookeeper" {
  metadata {
    name      = "zookeeper"
    namespace = var.namespace
  }
  spec {
    selector = { app = "zookeeper" }
    port {
      port        = 2181
      target_port = 2181
    }
  }
}

resource "kubernetes_deployment_v1" "zookeeper" {
  metadata {
    name      = "zookeeper"
    namespace = var.namespace
  }
  spec {
    replicas = 1
    selector { match_labels = { app = "zookeeper" } }
    template {
      metadata { labels = { app = "zookeeper" } }
      spec {
        container {
          name  = "zookeeper"
          image = "bitnami/zookeeper:latest"
          env {
            name  = "ALLOW_ANONYMOUS_LOGIN"
            value = "yes"
          }
          port { container_port = 2181 }
        }
      }
    }
  }
}

resource "kubernetes_service_v1" "kafka" {
  metadata {
    name      = "kafka"
    namespace = var.namespace
  }
  spec {
    selector = { app = "kafka" }
    port {
      name        = "broker"
      port        = 9092
      target_port = 9092
    }
    port {
      name        = "controller"
      port        = 9093
      target_port = 9093
    }
  }
}

resource "kubernetes_deployment_v1" "kafka" {
  metadata {
    name      = "kafka"
    namespace = var.namespace
  }
  spec {
    replicas = 1
    selector { match_labels = { app = "kafka" } }
    template {
      metadata { labels = { app = "kafka" } }
      spec {
        container {
          name  = "kafka"
          image = "bitnami/kafka:latest"
          env {
            name  = "KAFKA_CFG_PROCESS_ROLES"
            value = "broker,controller"
          }
          env {
            name  = "KAFKA_CFG_NODE_ID"
            value = "1"
          }
          env {
            name  = "KAFKA_CFG_LISTENERS"
            value = "PLAINTEXT://:9092,CONTROLLER://:9093"
          }
          env {
            name  = "KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP"
            value = "PLAINTEXT:PLAINTEXT,CONTROLLER:PLAINTEXT"
          }
          env {
            name  = "KAFKA_CFG_CONTROLLER_LISTENER_NAMES"
            value = "CONTROLLER"
          }
          env {
            name  = "KAFKA_CFG_CONTROLLER_QUORUM_VOTERS"
            value = "1@kafka:9093"
          }
          env {
            name  = "KAFKA_CFG_INTER_BROKER_LISTENER_NAME"
            value = "PLAINTEXT"
          }
          env {
            name  = "KAFKA_CFG_ADVERTISED_LISTENERS"
            value = "PLAINTEXT://kafka:9092"
          }
          env {
            name  = "KAFKA_CFG_AUTO_CREATE_TOPICS_ENABLE"
            value = "true"
          }
          env {
            name  = "ALLOW_PLAINTEXT_LISTENER"
            value = "yes"
          }
          port { container_port = 9092 }
          port { container_port = 9093 }
        }
      }
    }
  }
}
