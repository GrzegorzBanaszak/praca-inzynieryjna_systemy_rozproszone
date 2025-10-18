resource "kubernetes_secret_v1" "jwt" {
  metadata {
    name      = "jwt-secret"
    namespace = var.namespace
  }
  type = "Opaque"
  data = {
    "Jwt__Key"              = var.jwt_key
    "Jwt__Issuer"           = var.jwt_issuer
    "Jwt__Audience"         = var.jwt_audience
    "Jwt__ExpiresInMinutes" = var.jwt_expires
  }
  depends_on = [kubernetes_namespace_v1.ns]
}

resource "kubernetes_config_map_v1" "product_cfg" {
  metadata {
    name      = "product-config"
    namespace = var.namespace
  }
  data = {
    "MongoDbSettings__ConnectionString" = "mongodb://mongo:27017"
    "MongoDbSettings__DatabaseName"     = "ProductDb"
    "MongoDbSettings__CollectionName"   = "Products"
  }
  depends_on = [kubernetes_namespace_v1.ns]
}

resource "kubernetes_config_map_v1" "user_cfg" {
  metadata {
    name      = "user-config"
    namespace = var.namespace
  }
  data = {
    "ConnectionStrings__DefaultConnection" = "Host=postgres;Port=5432;Database=UserDb;Username=${var.pg_user};Password=${var.pg_password}"
    "JwtSettings__Issuer"                  = var.jwt_issuer
    "JwtSettings__Audience"                = var.jwt_audience
  }

  depends_on = [kubernetes_namespace_v1.ns]
}

resource "kubernetes_config_map_v1" "order_cfg" {
  metadata {
    name      = "order-config"
    namespace = var.namespace
  }
  data = {
    "ConnectionStrings__DefaultConnection" = "Host=orderdb;Port=5432;Database=OrderDb;Username=${var.pg_user};Password=${var.pg_password}"
    "KafkaSettings__BootstrapServers"      = "kafka:9092"
    "KafkaSettings__Topic"                 = "orders"
    "JwtSettings__Issuer"                  = var.jwt_issuer
    "JwtSettings__Audience"                = var.jwt_audience
  }
  depends_on = [kubernetes_namespace_v1.ns]
}
