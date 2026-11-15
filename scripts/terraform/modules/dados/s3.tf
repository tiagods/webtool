resource "aws_s3_bucket" "fichas" {
  bucket = var.bucket_name
}

resource "aws_s3_bucket_cors_configuration" "fichas" {
  bucket = aws_s3_bucket.fichas.id

  cors_rule {
    allowed_origins = var.cors_allowed_origins
    allowed_methods = ["PUT", "HEAD"]
    allowed_headers = ["Content-Type", "Content-Length", "x-amz-*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# Filtro por tag (não por prefixo): rascunhos são gravados com retention=rascunho e o
# copyObject do submit remove a tag. Um filtro por bucket inteiro apagaria os backups
# finais em protocolos/.
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
      days = var.lifecycle_retention_days
    }
  }

  depends_on = [aws_s3_bucket_versioning.fichas]
}

resource "aws_s3_bucket_public_access_block" "fichas" {
  count = var.harden_bucket ? 1 : 0

  bucket                  = aws_s3_bucket.fichas.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "fichas" {
  count = var.harden_bucket ? 1 : 0

  bucket = aws_s3_bucket.fichas.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "fichas" {
  count = var.harden_bucket ? 1 : 0

  bucket = aws_s3_bucket.fichas.id

  versioning_configuration {
    status = "Enabled"
  }
}
