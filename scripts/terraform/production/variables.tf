variable "region" {
  type    = string
  default = "us-east-1"
}

variable "cors_allowed_origins" {
  description = "Origem pública do frontend, autorizada a fazer upload direto no bucket."
  type        = list(string)
  default     = ["https://prolinkcontabil.com.br"]
}
