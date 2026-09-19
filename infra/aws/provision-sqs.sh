#!/usr/bin/env sh
# Provisiona as filas SQS de produção de forma idempotente.
#
#   - prolink-abertura-dlq  (MessageRetentionPeriod 14 dias)
#   - prolink-abertura      (VisibilityTimeout 120s, retenção 24h,
#                            redrive para a DLQ após 5 falhas)
# Se as filas já existem, apenas reaplica os atributos estruturais.
#
# Uso: AWS_REGION=us-east-1 ./infra/aws/provision-sqs.sh

set -eu

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
# shellcheck source=infra/aws/lib/common.sh
. "$SCRIPT_DIR/lib/common.sh"
# shellcheck source=infra/aws/lib/params.sh
. "$SCRIPT_DIR/lib/params.sh"

init_aws

log "SQS — região $REGION, conta $ACCOUNT_ID"

# ─── DLQ ─────────────────────────────────────────────────────────────────────
if sqs_queue_exists "$SQS_DLQ_NAME"; then
  DLQ_URL=$(aws_r sqs get-queue-url --queue-name "$SQS_DLQ_NAME" --query QueueUrl --output text)
  log "  $SQS_DLQ_NAME: já existe"
else
  DLQ_URL=$(aws_r sqs create-queue --queue-name "$SQS_DLQ_NAME" \
    --attributes "{\"MessageRetentionPeriod\":\"$SQS_DLQ_RETENTION_SECONDS\"}" \
    --query QueueUrl --output text)
  log "  $SQS_DLQ_NAME: criada"
fi

aws_r sqs set-queue-attributes \
  --queue-url "$DLQ_URL" \
  --attributes "{\"MessageRetentionPeriod\":\"$SQS_DLQ_RETENTION_SECONDS\"}"

DLQ_ARN=$(aws_r sqs get-queue-attributes \
  --queue-url "$DLQ_URL" \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' \
  --output text)

# ─── Fila principal ──────────────────────────────────────────────────────────
if sqs_queue_exists "$SQS_QUEUE_NAME"; then
  QUEUE_URL=$(aws_r sqs get-queue-url --queue-name "$SQS_QUEUE_NAME" --query QueueUrl --output text)
  log "  $SQS_QUEUE_NAME: já existe"
else
  QUEUE_URL=$(aws_r sqs create-queue --queue-name "$SQS_QUEUE_NAME" \
    --query QueueUrl --output text)
  log "  $SQS_QUEUE_NAME: criada"
fi

aws_r sqs set-queue-attributes \
  --queue-url "$QUEUE_URL" \
  --attributes "{\"VisibilityTimeout\":\"$SQS_VISIBILITY_TIMEOUT\",\"MessageRetentionPeriod\":\"$SQS_RETENTION_SECONDS\"}"

# RedrivePolicy é um JSON *stringificado* dentro de Attributes.
REDRIVE=$(jq -n \
  --arg arn "$DLQ_ARN" \
  --arg max "$SQS_MAX_RECEIVE_COUNT" \
  '{deadLetterTargetArn:$arn,maxReceiveCount:$max}')
REDRIVE_ATTRS=$(jq -n --argjson redrive "$REDRIVE" '{RedrivePolicy:($redrive|tojson)}')

aws_r sqs set-queue-attributes \
  --queue-url "$QUEUE_URL" \
  --attributes "$REDRIVE_ATTRS"

log "SQS: pronto (fila + DLQ + redrive maxReceiveCount=$SQS_MAX_RECEIVE_COUNT)."
