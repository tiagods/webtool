output "tabelas" {
  value = module.dados.table_names
}

output "bucket" {
  value = module.dados.bucket_name
}

output "fila_url" {
  value = module.dados.queue_url
}

output "iam_users" {
  value = [aws_iam_user.api.name, aws_iam_user.worker.name]
}
