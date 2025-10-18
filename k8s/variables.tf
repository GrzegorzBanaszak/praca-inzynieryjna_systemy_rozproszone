variable "namespace" {
  type    = string
  default = "distributed-system"
}
variable "host" {
  type    = string
  default = "distributed.local"
}
variable "kubeconfig_path" {
  type    = string
  default = "~/.kube/config"
}
variable "kube_context" {
  type    = string
  default = "minikube"
}

variable "production_app_name" {
  type    = string
  default = "productservice"
}

variable "image_userservice" {
  type    = string
  default = "userservice:latest"
}
variable "image_productservice" {
  type    = string
  default = "productservice:latest"
}
variable "image_orderservice" {
  type    = string
  default = "orderservice:latest"
}
variable "image_notificationservice" {
  type    = string
  default = "notificationservice:latest"
}
variable "image_apigatewayservice" {
  type    = string
  default = "apigatewayservice:latest"
}

# JWT (sekret – podmień wartości w razie potrzeby)
variable "jwt_key" {
  type    = string
  default = "f3Pz7dX9sL2nM6aQ1vT4rY8kU0iO5pE9jH2gB7hK4cV6xZ1bN3mL8qW2eR5tY0u"
}
variable "jwt_issuer" {
  type    = string
  default = "MyApp"
}
variable "jwt_audience" {
  type    = string
  default = "MyAppUsers"
}
variable "jwt_expires" {
  type    = string
  default = "60"
}

# proste hasła do Postgresa (dev)
variable "pg_user" {
  type    = string
  default = "postgres"
}
variable "pg_password" {
  type    = string
  default = "postgres"
}
