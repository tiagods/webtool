output "tabelas" {
  value = { for k, t in aws_dynamodb_table.this : k => t.name }
}

output "bucket" {
  value = aws_s3_bucket.fichas.bucket
}

output "fila_url" {
  value = aws_sqs_queue.submissoes.url
}

output "iam_users" {
  value = [aws_iam_user.api.name, aws_iam_user.worker.name]
}
