output "table_names" {
  value = { for k, t in aws_dynamodb_table.this : k => t.name }
}

output "table_arns" {
  value = { for k, t in aws_dynamodb_table.this : k => t.arn }
}

output "bucket_name" {
  value = aws_s3_bucket.fichas.bucket
}

output "bucket_arn" {
  value = aws_s3_bucket.fichas.arn
}

output "queue_name" {
  value = aws_sqs_queue.submissoes.name
}

output "queue_url" {
  value = aws_sqs_queue.submissoes.url
}

output "queue_arn" {
  value = aws_sqs_queue.submissoes.arn
}

output "dlq_arn" {
  value = aws_sqs_queue.dlq.arn
}
