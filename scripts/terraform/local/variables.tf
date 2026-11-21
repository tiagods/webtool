variable "endpoint_url" {
  description = "Endpoint do localstack"
  type        = string
  default     = "http://floci:4566"
}

variable "region" {
  type    = string
  default = "us-east-1"
}

variable "cors_allowed_origins" {
  type    = list(string)
  default = ["http://localhost:3000"]
}
