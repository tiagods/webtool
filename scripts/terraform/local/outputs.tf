output "tabelas" {
  value = { for k, t in aws_dynamodb_table.this : k => t.name }
}

output "bucket" {
  value = aws_s3_bucket.fichas.bucket
}

output "fila_url" {
  value = aws_sqs_queue.submissoes.url
}

output "dlq_arn" {
  value = aws_sqs_queue.dlq.arn
}
