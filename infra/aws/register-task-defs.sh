#!/usr/bin/env sh
# Registra as task definitions Fargate de api e worker (idempotente por revisão).
#
# Resolve os placeholders de ecs/*.taskdef.json com os valores de params.sh, as
# ARNs reais dos secrets e a URL da fila, e chama `aws ecs
# register-task-definition`. NÃO cria cluster/service/rede — isso é da spec de
# rede (021b). As imagens são publicadas no ECR por um passo de build/deploy à
# parte; aqui elas entram como URI completa.
#
# Requer:
#   API_IMAGE_URI, WORKER_IMAGE_URI  (URI completa da imagem no ECR)
#   SMTP_HOST, SMTP_USER             (endereço de saída do e-mail)
# Opcionais: SMTP_FROM, SMTP_TO.
#
# Uso:
#   API_IMAGE_URI=... WORKER_IMAGE_URI=... SMTP_HOST=... SMTP_USER=... \
#     ./infra/aws/register-task-defs.sh

set -eu

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
# shellcheck source=infra/aws/lib/common.sh
. "$SCRIPT_DIR/lib/common.sh"
# shellcheck source=infra/aws/lib/params.sh
. "$SCRIPT_DIR/lib/params.sh"

ECS_DIR="$SCRIPT_DIR/ecs"

API_IMAGE_URI="${API_IMAGE_URI:-}"
WORKER_IMAGE_URI="${WORKER_IMAGE_URI:-}"
SMTP_HOST="${SMTP_HOST:-}"
SMTP_USER="${SMTP_USER:-}"
SMTP_FROM="${SMTP_FROM:-noreply@prolinkcontabil.com.br}"
SMTP_TO="${SMTP_TO:-tiagoice@hotmail.com}"

init_aws

[ -n "$API_IMAGE_URI" ] || die "API_IMAGE_URI é obrigatória (URI da imagem no ECR)"
[ -n "$WORKER_IMAGE_URI" ] || die "WORKER_IMAGE_URI é obrigatória (URI da imagem no ECR)"
[ -n "$SMTP_HOST" ] || die "SMTP_HOST é obrigatório"
[ -n "$SMTP_USER" ] || die "SMTP_USER é obrigatório"

# Dependências resolvidas em runtime (não são placeholders estáticos).
SQS_QUEUE_URL=$(aws_r sqs get-queue-url --queue-name "$SQS_QUEUE_NAME" --query QueueUrl --output text)
JWT_SECRET_ARN=$(aws_r secretsmanager describe-secret --secret-id "$SECRET_JWT_NAME" --query ARN --output text)
SMTP_PASSWORD_ARN=$(aws_r secretsmanager describe-secret --secret-id "$SECRET_SMTP_NAME" --query ARN --output text)

export API_IMAGE_URI WORKER_IMAGE_URI
export SMTP_HOST SMTP_USER SMTP_FROM SMTP_TO
export SQS_QUEUE_URL JWT_SECRET_ARN SMTP_PASSWORD_ARN

register() {
  family="$1"
  template="$2"

  def=$(render_template "$template") || die "falha ao renderizar $template"
  arn=$(aws_r ecs register-task-definition \
    --cli-input-json "$def" \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text)
  log "  $family: registrada ($arn)"
}

log "ECS task definitions — região $REGION, conta $ACCOUNT_ID"
register "$ECS_API_FAMILY" "$ECS_DIR/api.taskdef.json"
register "$ECS_WORKER_FAMILY" "$ECS_DIR/worker.taskdef.json"
log "Task definitions: prontas."
