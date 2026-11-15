# Compartilhado: o ambiente define local.cors_allowed_origins.
# O endurecimento do bucket (block public access, SSE, versioning) é só de production.
resource "aws_s3_bucket" "fichas" {
  bucket = "prolink-fichas"
}

resource "aws_s3_bucket_cors_configuration" "fichas" {
  bucket = aws_s3_bucket.fichas.id

  cors_rule {
    allowed_origins = local.cors_allowed_origins
    allowed_methods = ["PUT", "HEAD"]
    allowed_headers = ["Content-Type", "Content-Length", "x-amz-*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# Filtro por tag (não por prefixo): rascunhos são gravados com retention=rascunho e o
# copyObject do submit remove a tag. Um filtro por bucket inteiro apagaria os backups
# finais em protocolos/ (LGPD Art. 16: rascunhos abandonados somem em 30 dias).
resource "aws_s3_bucket_lifecycle_configuration" "fichas" {
  bucket = aws_s3_bucket.fichas.id

  rule {
    id     = "delete-rascunhos-abandonados"
    status = "Enabled"

    filter {
      tag {
        key   = "retention"
        value = "rascunho"
      }
    }

    expiration {
      days = 30
    }
  }
}
