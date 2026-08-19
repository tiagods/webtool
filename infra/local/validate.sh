#!/usr/bin/env bash
# Valida que todos os recursos AWS estão provisionados no Floci
# Uso: ./infra/local/validate.sh

set -euo pipefail

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
if $AWS dynamodb describe-table --table-name fichas-abertura \
   --query 'Table.TableStatus' --output text 2>/dev/null | grep -q ACTIVE; then
  ok "Tabela fichas-abertura existe e está ACTIVE"

  TTL_STATUS=$($AWS dynamodb describe-time-to-live \
    --table-name fichas-abertura \
    --query 'TimeToLiveDescription.TimeToLiveStatus' --output text 2>/dev/null)
  if [ "$TTL_STATUS" = "ENABLED" ]; then
    ok "TTL habilitado (atributo: ttl)"
  else
    fail "TTL não está habilitado (status: $TTL_STATUS)"
  fi
else
  fail "Tabela fichas-abertura não encontrada"
fi

# ─── S3 ──────────────────────────────────────────────────────────────────────
echo ""
echo "▸ S3..."
if $AWS s3api head-bucket --bucket prolink-fichas 2>/dev/null; then
  ok "Bucket prolink-fichas existe"

  CORS=$($AWS s3api get-bucket-cors --bucket prolink-fichas 2>/dev/null | grep -c "AllowedMethod" || true)
  if [ "$CORS" -gt 0 ]; then
    ok "CORS configurado"
  else
    fail "CORS não configurado no bucket"
  fi
else
  fail "Bucket prolink-fichas não encontrado"
fi

# ─── SQS ─────────────────────────────────────────────────────────────────────
echo ""
echo "▸ SQS..."
QUEUE_URL=$($AWS sqs get-queue-url --queue-name prolink-abertura \
  --query 'QueueUrl' --output text 2>/dev/null || true)
if [ -n "$QUEUE_URL" ]; then
  ok "Fila prolink-abertura existe"
  echo "     URL: $QUEUE_URL"
else
  fail "Fila prolink-abertura não encontrada"
fi

# ─── SNS ─────────────────────────────────────────────────────────────────────
echo ""
echo "▸ SNS..."
SNS_ARN=$($AWS sns list-topics --query 'Topics[?contains(TopicArn,`prolink-abertura-emails`)].TopicArn' --output text 2>/dev/null || true)
if [ -n "$SNS_ARN" ]; then
  ok "Tópico prolink-abertura-emails existe"
  echo "     ARN: $SNS_ARN"
  SUBS=$($AWS sns list-subscriptions-by-topic --topic-arn "$SNS_ARN" --query 'Subscriptions[].Endpoint' --output text 2>/dev/null || true)
  if echo "$SUBS" | grep -q "prolinkcontabil"; then
    ok "SES subscription: contato@prolinkcontabil.com.br"
  else
    fail "SES subscription não encontrada no tópico"
  fi
else
  fail "Tópico prolink-abertura-emails não encontrado"
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
