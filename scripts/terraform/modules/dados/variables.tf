variable "abertura_table_name" {
  description = "Tabela de rascunhos/fichas de abertura."
  type        = string
  default     = "FichasAbertura"
}

variable "alteracao_table_name" {
  description = "Tabela de rascunhos/fichas de alteração."
  type        = string
  default     = "FichasAlteracao"
}

variable "aceites_table_name" {
  description = "Tabela de aceites LGPD."
  type        = string
  default     = "AceitesLgpd"
}

variable "bucket_name" {
  type    = string
  default = "prolink-fichas"
}

variable "queue_name" {
  type    = string
  default = "FichasSubmissoes"
}

variable "dlq_name" {
  type    = string
  default = "FichasSubmissoesDLQ"
}

variable "cors_allowed_origins" {
  description = "Origens autorizadas a fazer PUT/HEAD direto no bucket (presigned upload)."
  type        = list(string)
}

variable "enable_pitr" {
  description = "Point-in-Time Recovery nas tabelas (só production)."
  type        = bool
  default     = false
}

variable "harden_bucket" {
  description = "Block public access, SSE-S3 e versioning no bucket (só production)."
  type        = bool
  default     = false
}

variable "ttl_attribute" {
  type    = string
  default = "ttl"
}

variable "sqs_visibility_timeout_seconds" {
  type    = number
  default = 120
}

variable "sqs_retention_seconds" {
  type    = number
  default = 86400
}

variable "sqs_dlq_retention_seconds" {
  type    = number
  default = 1209600
}

variable "sqs_max_receive_count" {
  type    = number
  default = 5
}

variable "lifecycle_retention_days" {
  description = "Expiração dos rascunhos abandonados (LGPD Art. 16)."
  type        = number
  default     = 30
}
