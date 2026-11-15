resource "aws_sqs_queue" "dlq" {
  name                      = "FichasSubmissoesDLQ"
  message_retention_seconds = 1209600
}

resource "aws_sqs_queue" "submissoes" {
  name                       = "FichasSubmissoes"
  visibility_timeout_seconds = 120
  message_retention_seconds  = 86400

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 5
  })
}
