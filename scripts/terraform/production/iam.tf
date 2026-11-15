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
    resources = values(module.dados.table_arns)
  }

  statement {
    sid       = "S3DocumentosObjetos"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:PutObjectTagging"]
    resources = ["${module.dados.bucket_arn}/*"]
  }

  statement {
    sid       = "S3ListarBucket"
    actions   = ["s3:ListBucket"]
    resources = [module.dados.bucket_arn]
  }

  statement {
    sid       = "SQSPublicarSubmissao"
    actions   = ["sqs:SendMessage"]
    resources = [module.dados.queue_arn]
  }
}

data "aws_iam_policy_document" "worker" {
  statement {
    sid       = "DynamoDBRascunhos"
    actions   = ["dynamodb:GetItem", "dynamodb:UpdateItem"]
    resources = [module.dados.table_arns["abertura"], module.dados.table_arns["alteracao"]]
  }

  statement {
    sid       = "S3PresignDownload"
    actions   = ["s3:GetObject"]
    resources = ["${module.dados.bucket_arn}/*"]
  }

  statement {
    sid       = "SQSConsumirSubmissao"
    actions   = ["sqs:ReceiveMessage", "sqs:DeleteMessage"]
    resources = [module.dados.queue_arn]
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
