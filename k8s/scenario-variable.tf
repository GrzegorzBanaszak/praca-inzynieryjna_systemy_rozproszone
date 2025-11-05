variable "scaling_type" {
  type        = string
  default     = "large"
  description = "Which scaling scenario to deploy: small, medium, large"
}



variable "scenario_small" {
  type = object({
    replicas    = number
    cpu_request = string
    cpu_limit   = string
    mem_request = string
    mem_limit   = string
  })
  default = {
    replicas    = 1
    cpu_request = "100m"
    cpu_limit   = "150m"
    mem_request = "128Mi"
    mem_limit   = "256Mi"
  }
  description = "small"
}

variable "scenario_medium" {
  type = object({
    replicas    = number
    cpu_request = string
    cpu_limit   = string
    mem_request = string
    mem_limit   = string
  })
  default = {
    replicas    = 3
    cpu_request = "200m"
    cpu_limit   = "350m"
    mem_request = "128Mi"
    mem_limit   = "256Mi"
  }
  description = "medium"
}

variable "scenario_large" {
  type = object({
    replicas    = number
    cpu_request = string
    cpu_limit   = string
    mem_request = string
    mem_limit   = string
  })
  default = {
    replicas    = 1
    cpu_request = "400m"
    cpu_limit   = "600m"
    mem_request = "512Mi"
    mem_limit   = "1024Mi"
  }
  description = "large"
}
