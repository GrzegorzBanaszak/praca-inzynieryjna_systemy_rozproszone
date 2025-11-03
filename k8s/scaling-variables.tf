# Variables for Scaling Tests - Chapter 5.1
# Use these to switch between different scaling scenarios

# Scenario selector: "baseline" | "horizontal" | "vertical" | "hpa"
variable "scaling_scenario" {
  type        = string
  default     = "hpa"
  description = "Which scaling scenario to deploy: baseline, horizontal, vertical, or hpa"
}

# Scenario 1: Baseline - Single pod with limited resources
variable "scenario_baseline" {
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
  description = "Baseline configuration: minimal resources, single pod"
}

# Scenario 2: Horizontal Scaling - 3 pods with same resources as baseline
variable "scenario_horizontal" {
  type = object({
    replicas    = number
    cpu_request = string
    cpu_limit   = string
    mem_request = string
    mem_limit   = string
  })
  default = {
    replicas    = 3
    cpu_request = "100m"
    cpu_limit   = "150m"
    mem_request = "128Mi"
    mem_limit   = "256Mi"
  }
  description = "Horizontal scaling: 3x pods with same resources"
}

# Scenario 3: Vertical Scaling - Single pod with increased resources
variable "scenario_vertical" {
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
  description = "Vertical scaling: 1 pod with 4x CPU resources"
}

# Scenario 4: HPA - Autoscaling configuration
variable "scenario_hpa" {
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
  description = "HPA autoscaling: starts with 1 pod, scales 1-5 based on CPU"
}

# HPA specific settings
variable "hpa_enabled" {
  type        = bool
  default     = true
  description = "Enable HPA for scenario 4"
}

variable "hpa_min_replicas" {
  type        = number
  default     = 1
  description = "Minimum number of replicas for HPA"
}

variable "hpa_max_replicas" {
  type        = number
  default     = 5
  description = "Maximum number of replicas for HPA"
}

variable "hpa_target_cpu_utilization" {
  type        = number
  default     = 70
  description = "Target CPU utilization percentage for HPA scaling"
}
