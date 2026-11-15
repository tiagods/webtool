# Sem aws_iam_access_key: o secret iria para o state. O operador gera as chaves
# no console/CLI e as põe no .env do servidor.
resource "aws_iam_user" "api" {
  name = "ApiApp"
}

resource "aws_iam_user" "worker" {
  name = "WorkerApp"
}

data "aws_iam_policy_document" "api" {
  statement {
    sid       = "DynamoDBRascunhosEAceites"
    actions   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem"]
    resources = values(aws_dynamodb_table.this)[*].arn
  }

  statement {
    sid       = "S3DocumentosObjetos"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:PutObjectTagging"]
    resources = ["${aws_s3_bucket.fichas.arn}/*"]
  }

  statement {
    sid       = "S3ListarBucket"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.fichas.arn]
  }

  statement {
    sid       = "SQSPublicarSubmissao"
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.submissoes.arn]
  }
}

data "aws_iam_policy_document" "worker" {
  statement {
    sid       = "DynamoDBRascunhos"
    actions   = ["dynamodb:GetItem", "dynamodb:UpdateItem"]
    resources = [aws_dynamodb_table.this["abertura"].arn, aws_dynamodb_table.this["alteracao"].arn]
  }

  statement {
    sid       = "S3PresignDownload"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.fichas.arn}/*"]
  }

  statement {
    sid       = "SQSConsumirSubmissao"
    actions   = ["sqs:ReceiveMessage", "sqs:DeleteMessage"]
    resources = [aws_sqs_queue.submissoes.arn]
  }
}

resource "aws_iam_user_policy" "api" {
  name   = "ApiAppPolicy"
  user   = aws_iam_user.api.name
  policy = data.aws_iam_policy_document.api.json
}

resource "aws_iam_user_policy" "worker" {
  name   = "WorkerAppPolicy"
  user   = aws_iam_user.worker.name
  policy = data.aws_iam_policy_document.worker.json
}
