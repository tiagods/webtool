output "tabelas" {
  value = module.dados.table_names
}

output "bucket" {
  value = module.dados.bucket_name
}

output "fila_url" {
  value = module.dados.queue_url
}

output "dlq_arn" {
  value = module.dados.dlq_arn
}
