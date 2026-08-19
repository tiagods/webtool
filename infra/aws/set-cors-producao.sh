#!/usr/bin/env sh
# Configura o CORS do bucket S3 de produção (AWS real, sem endpoint local).
# Uso: PROD_ORIGIN=https://prolinkcontabil.com.br ./set-cors-producao.sh

set -eu

BUCKET="${AWS_S3_BUCKET:-prolink-fichas}"
ORIGIN="${PROD_ORIGIN:-https://prolinkcontabil.com.br}"
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
AWS="aws --region $REGION"

echo "🪣 Configurando CORS do bucket $BUCKET para origin $ORIGIN..."

$AWS s3api put-bucket-cors \
  --bucket "$BUCKET" \
  --cors-configuration "{\"CORSRules\":[{\"AllowedOrigins\":[\"$ORIGIN\"],\"AllowedMethods\":[\"PUT\",\"HEAD\"],\"AllowedHeaders\":[\"Content-Type\",\"Content-Length\",\"x-amz-*\"],\"ExposeHeaders\":[\"ETag\"],\"MaxAgeSeconds\":3000}]}"

echo "✅ CORS aplicado: $BUCKET → AllowedOrigins=[$ORIGIN]"
