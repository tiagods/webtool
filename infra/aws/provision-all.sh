#!/usr/bin/env sh
# Roda todo o provisionamento de produção na ordem correta (idempotente).
#
#   1. DynamoDB    2. S3    3. SQS    4. IAM + log groups    5. Secrets Manager
#   6. Task definitions — só se API_IMAGE_URI e WORKER_IMAGE_URI estiverem
#      definidas (as imagens são publicadas no ECR por um passo à parte).
#
# Uso: AWS_REGION=us-east-1 ./infra/aws/provision-all.sh

set -eu

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
# shellcheck source=infra/aws/lib/common.sh
. "$SCRIPT_DIR/lib/common.sh"

for step in provision-dynamodb provision-s3 provision-sqs provision-iam provision-secrets; do
  log "==> $step.sh"
  sh "$SCRIPT_DIR/$step.sh"
done

if [ -n "${API_IMAGE_URI:-}" ] && [ -n "${WORKER_IMAGE_URI:-}" ]; then
  log "==> register-task-defs.sh"
  sh "$SCRIPT_DIR/register-task-defs.sh"
else
  warn "API_IMAGE_URI/WORKER_IMAGE_URI não definidas — pulando register-task-defs.sh"
fi

log "Provisionamento completo."
