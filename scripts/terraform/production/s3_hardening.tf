resource "aws_s3_bucket_public_access_block" "fichas" {
  bucket                  = aws_s3_bucket.fichas.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "fichas" {
  bucket = aws_s3_bucket.fichas.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Depois do lifecycle: as duas configurações do mesmo bucket não podem rodar em paralelo.
resource "aws_s3_bucket_versioning" "fichas" {
  bucket = aws_s3_bucket.fichas.id

  versioning_configuration {
    status = "Enabled"
  }

  depends_on = [aws_s3_bucket_lifecycle_configuration.fichas]
}
