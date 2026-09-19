#!/usr/bin/env sh
# Cria/atualiza as IAM roles de produção (idempotente) e os log groups do ECS.
#
#   prolink-ecs-execution-role  — pull de imagem no ECR + logs + leitura dos
#                                 secrets injetados (JWT_SECRET, SMTP_PASSWORD)
#   prolink-api-task-role       — runtime da API (DynamoDB, S3, SQS)
#   prolink-worker-task-role    — runtime do worker (DynamoDB, S3, SQS)
#
# As policies ficam em iam/*.json, com placeholders ${...} resolvidos de
# params.sh. Nenhum Resource: "*" — ARNs explícitos por recurso. O worker só
# recebe GetObject no S3 (assina URLs de download) e GetItem/UpdateItem no
# DynamoDB; o redrive da DLQ é feito pelo próprio SQS.
#
# Log groups: /ecs/prolink-api e /ecs/prolink-worker (retenção 30d).
#
# Uso: AWS_REGION=us-east-1 ./infra/aws/provision-iam.sh

set -eu

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
# shellcheck source=infra/aws/lib/common.sh
. "$SCRIPT_DIR/lib/common.sh"
# shellcheck source=infra/aws/lib/params.sh
. "$SCRIPT_DIR/lib/params.sh"

IAM_DIR="$SCRIPT_DIR/iam"

init_aws

log "IAM — região $REGION, conta $ACCOUNT_ID"

ensure_role() {
  role="$1"
  trust="$2"

  if iam_role_exists "$role"; then
    log "  $role: já existe"
    aws_r iam update-assume-role-policy \
      --role-name "$role" \
      --policy-document "$(cat "$trust")" >/dev/null
  else
    log "  $role: criando..."
    aws_r iam create-role \
      --role-name "$role" \
      --assume-role-policy-document "$(cat "$trust")" >/dev/null
  fi
}

put_inline_policy() {
  role="$1"
  name="$2"
  template="$3"

  policy=$(render_template "$template") || die "falha ao renderizar $template"
  aws_r iam put-role-policy \
    --role-name "$role" \
    --policy-name "$name" \
    --policy-document "$policy"
  log "  $role: policy inline '$name' aplicada"
}

ensure_log_group() {
  group="$1"

  if log_group_exists "$group"; then
    log "  $group: já existe"
  else
    log "  $group: criando..."
    aws_r logs create-log-group --log-group-name "$group"
  fi

  aws_r logs put-retention-policy \
    --log-group-name "$group" \
    --retention-in-days "$ECS_LOG_RETENTION_DAYS" >/dev/null
  log "  $group: retenção ${ECS_LOG_RETENTION_DAYS}d ok"
}

# ─── Roles ───────────────────────────────────────────────────────────────────
ensure_role "$ECS_EXECUTION_ROLE_NAME" "$IAM_DIR/ecs-execution-role.trust.json"
ensure_role "$API_TASK_ROLE_NAME" "$IAM_DIR/api-task-role.trust.json"
ensure_role "$WORKER_TASK_ROLE_NAME" "$IAM_DIR/worker-task-role.trust.json"

# ─── Policies ────────────────────────────────────────────────────────────────
# Managed policy: pull no ECR + logs:CreateLogStream/PutLogEvents.
aws_r iam attach-role-policy \
  --role-name "$ECS_EXECUTION_ROLE_NAME" \
  --policy-arn "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"

put_inline_policy "$ECS_EXECUTION_ROLE_NAME" "prolink-secrets-read" "$IAM_DIR/ecs-execution-role.policy.json"
put_inline_policy "$API_TASK_ROLE_NAME" "prolink-api-task-policy" "$IAM_DIR/api-task-role.policy.json"
put_inline_policy "$WORKER_TASK_ROLE_NAME" "prolink-worker-task-policy" "$IAM_DIR/worker-task-role.policy.json"

# ─── Log groups ──────────────────────────────────────────────────────────────
ensure_log_group "$ECS_API_LOG_GROUP"
ensure_log_group "$ECS_WORKER_LOG_GROUP"

log "IAM + logs: prontos."
