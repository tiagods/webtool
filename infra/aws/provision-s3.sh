#!/usr/bin/env sh
# Provisiona o bucket S3 de produção de forma idempotente.
#
# Aplica: Block Public Access (4 flags), SSE-S3 (AES256), Versioning,
# Lifecycle `delete-rascunhos-abandonados` (expira objetos com tag
# retention=rascunho após 30 dias) e CORS PUT/HEAD restrito a PROD_ORIGIN.
# Absorve o antigo infra/aws/set-cors-producao.sh.
#
# Uso: PROD_ORIGIN=https://prolinkcontabil.com.br ./infra/aws/provision-s3.sh

set -eu

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
# shellcheck source=infra/aws/lib/common.sh
. "$SCRIPT_DIR/lib/common.sh"
# shellcheck source=infra/aws/lib/params.sh
. "$SCRIPT_DIR/lib/params.sh"

PROD_ORIGIN="${PROD_ORIGIN:-https://prolinkcontabil.com.br}"

init_aws

log "S3 — bucket $S3_BUCKET, região $REGION, origin $PROD_ORIGIN"

# ─── Bucket ──────────────────────────────────────────────────────────────────
if s3_bucket_exists "$S3_BUCKET"; then
  log "  $S3_BUCKET: já existe"
else
  log "  $S3_BUCKET: criando..."
  if [ "$REGION" = "us-east-1" ]; then
    aws_r s3api create-bucket --bucket "$S3_BUCKET" >/dev/null
  else
    aws_r s3api create-bucket --bucket "$S3_BUCKET" \
      --create-bucket-configuration "LocationConstraint=$REGION" >/dev/null
  fi
fi

# ─── Block Public Access ─────────────────────────────────────────────────────
aws_r s3api put-public-access-block \
  --bucket "$S3_BUCKET" \
  --public-access-block-configuration \
  'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true'

# ─── Encryption at rest (SSE-S3) ─────────────────────────────────────────────
aws_r s3api put-bucket-encryption \
  --bucket "$S3_BUCKET" \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

# ─── Versioning ──────────────────────────────────────────────────────────────
aws_r s3api put-bucket-versioning \
  --bucket "$S3_BUCKET" \
  --versioning-configuration Status=Enabled

# ─── Lifecycle — expira rascunhos abandonados (LGPD Art. 16) ─────────────────
# Filtro por TAG (não por prefixo): no submit o copyObject remove a tag
# retention=rascunho, então os backups em protocolos/ nunca são alcançados.
LIFECYCLE=$(jq -n \
  --arg id "$S3_LIFECYCLE_RULE_ID" \
  --arg key "$S3_LIFECYCLE_TAG_KEY" \
  --arg value "$S3_LIFECYCLE_TAG_VALUE" \
  --argjson days "$S3_LIFECYCLE_RETENTION_DAYS" \
  '{Rules:[{ID:$id,Filter:{Tag:{Key:$key,Value:$value}},Status:"Enabled",Expiration:{Days:$days}}]}')

aws_r s3api put-bucket-lifecycle-configuration \
  --bucket "$S3_BUCKET" \
  --lifecycle-configuration "$LIFECYCLE"

# ─── CORS — upload do browser (PUT/HEAD) restrito ao domínio de produção ─────
CORS=$(jq -n --arg origin "$PROD_ORIGIN" \
  '{CORSRules:[{AllowedOrigins:[$origin],AllowedMethods:["PUT","HEAD"],AllowedHeaders:["Content-Type","Content-Length","x-amz-*"],ExposeHeaders:["ETag"],MaxAgeSeconds:3000}]}')

aws_r s3api put-bucket-cors \
  --bucket "$S3_BUCKET" \
  --cors-configuration "$CORS"

log "S3: pronto (public access block, SSE-S3, versioning, lifecycle, CORS)."
