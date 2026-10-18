#!/usr/bin/env bash
# Valida que todos os recursos AWS estão provisionados no Floci
# Uso: ./infra/local/validate.sh

set -euo pipefail

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
if [ -f "$SCRIPT_DIR/../aws/lib/params.sh" ]; then
  # shellcheck source=infra/aws/lib/params.sh
  . "$SCRIPT_DIR/../aws/lib/params.sh"
else
  echo "ERRO: infra/aws/lib/params.sh não encontrado" >&2
  exit 1
fi

ENDPOINT="${AWS_ENDPOINT_URL:-http://localhost:4566}"
REGION="${AWS_REGION:-us-east-1}"
AWS="aws --endpoint-url $ENDPOINT --region $REGION"
ERRORS=0

ok()  { echo "  ✅ $1"; }
fail(){ echo "  ❌ $1"; ERRORS=$((ERRORS+1)); }

echo ""
echo "════════════════════════════════════════════"
echo " Floci — Validação de recursos"
echo " Endpoint: $ENDPOINT"
echo "════════════════════════════════════════════"

# ─── Health ──────────────────────────────────────────────────────────────────
echo ""
echo "▸ Health check..."
if curl -sf "$ENDPOINT/_floci/health" > /dev/null 2>&1 || \
   curl -sf "$ENDPOINT/_localstack/health" > /dev/null 2>&1; then
  ok "Floci respondendo em $ENDPOINT"
else
  fail "Floci não responde em $ENDPOINT"
fi

# ─── DynamoDB ────────────────────────────────────────────────────────────────
echo ""
echo "▸ DynamoDB..."
if $AWS dynamodb describe-table --table-name "$DYNAMO_ABERTURA_TABLE" \
   --query 'Table.TableStatus' --output text 2>/dev/null | grep -q ACTIVE; then
  ok "Tabela $DYNAMO_ABERTURA_TABLE existe e está ACTIVE"

  TTL_STATUS=$($AWS dynamodb describe-time-to-live \
    --table-name "$DYNAMO_ABERTURA_TABLE" \
    --query 'TimeToLiveDescription.TimeToLiveStatus' --output text 2>/dev/null)
  if [ "$TTL_STATUS" = "ENABLED" ]; then
    ok "TTL habilitado (atributo: ttl)"
  else
    fail "TTL não está habilitado (status: $TTL_STATUS)"
  fi
else
  fail "Tabela $DYNAMO_ABERTURA_TABLE não encontrada"
fi

# ─── S3 ──────────────────────────────────────────────────────────────────────
echo ""
echo "▸ S3..."
if $AWS s3api head-bucket --bucket "$S3_BUCKET" 2>/dev/null; then
  ok "Bucket $S3_BUCKET existe"

  CORS=$($AWS s3api get-bucket-cors --bucket "$S3_BUCKET" 2>/dev/null | grep -c "AllowedMethod" || true)
  if [ "$CORS" -gt 0 ]; then
    ok "CORS configurado"
  else
    fail "CORS não configurado no bucket"
  fi
else
  fail "Bucket $S3_BUCKET não encontrado"
fi

# ─── SQS ─────────────────────────────────────────────────────────────────────
echo ""
echo "▸ SQS..."
QUEUE_URL=$($AWS sqs get-queue-url --queue-name "$SQS_QUEUE_NAME" \
  --query 'QueueUrl' --output text 2>/dev/null || true)
if [ -n "$QUEUE_URL" ]; then
  ok "Fila $SQS_QUEUE_NAME existe"
  echo "     URL: $QUEUE_URL"
else
  fail "Fila $SQS_QUEUE_NAME não encontrada"
fi

DLQ_URL=$($AWS sqs get-queue-url --queue-name "$SQS_DLQ_NAME" \
  --query 'QueueUrl' --output text 2>/dev/null || true)
if [ -n "$DLQ_URL" ]; then
  ok "DLQ $SQS_DLQ_NAME existe"
else
  fail "DLQ $SQS_DLQ_NAME não encontrada"
fi

# ─── Resultado ───────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════"
if [ "$ERRORS" -eq 0 ]; then
  echo " ✅ Todos os recursos OK"
else
  echo " ❌ $ERRORS problema(s) encontrado(s)"
fi
echo "════════════════════════════════════════════"
echo ""

exit $ERRORS
