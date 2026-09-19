#!/usr/bin/env sh
# Fonte única dos nomes e parâmetros estruturais dos recursos AWS.
#
# É consumido tanto pelos scripts de produção (infra/aws/provision-*.sh) quanto
# pelo provisionamento local (infra/local/init.sh), para que schema de tabela,
# atributos de fila e regras de lifecycle não divirjam entre Floci e AWS real.
#
# Este arquivo NÃO executa comandos AWS nem depende de `aws` — apenas define
# variáveis (com defaults) que os scripts usam. Não rode direto; use `. params.sh`.
#
# As variáveis são consumidas por scripts que fazem `source` deste arquivo, o que
# o shellcheck não consegue rastrear — daí o disable de SC2034.
# shellcheck disable=SC2034

# ─── Nomes dos recursos ──────────────────────────────────────────────────────
DYNAMO_ABERTURA_TABLE="${AWS_DYNAMODB_TABLE:-fichas-abertura}"
DYNAMO_ALTERACAO_TABLE="${AWS_DYNAMODB_ALTERACAO_TABLE:-fichas-alteracao}"
DYNAMO_ACEITES_TABLE="${AWS_DYNAMODB_ACEITES_TABLE:-prolink-aceites-lgpd}"
S3_BUCKET="${AWS_S3_BUCKET:-prolink-fichas}"
SQS_QUEUE_NAME="${SQS_QUEUE_NAME:-prolink-abertura}"
SQS_DLQ_NAME="${SQS_DLQ_NAME:-prolink-abertura-dlq}"

# ─── DynamoDB — chaves e TTL ─────────────────────────────────────────────────
DYNAMO_PK_ATTR="sessionId"
DYNAMO_SK_ATTR="versaoTermo"
DYNAMO_TTL_ATTR="ttl"
DYNAMO_BILLING_MODE="PAY_PER_REQUEST"

# ─── SQS — parâmetros estruturais ────────────────────────────────────────────
SQS_VISIBILITY_TIMEOUT="120"
SQS_RETENTION_SECONDS="86400"
SQS_DLQ_RETENTION_SECONDS="1209600"
SQS_MAX_RECEIVE_COUNT="5"

# ─── S3 — lifecycle dos rascunhos abandonados (LGPD Art. 16) ─────────────────
S3_LIFECYCLE_RULE_ID="delete-rascunhos-abandonados"
S3_LIFECYCLE_RETENTION_DAYS="30"
S3_LIFECYCLE_TAG_KEY="retention"
S3_LIFECYCLE_TAG_VALUE="rascunho"

# ─── Secrets Manager ─────────────────────────────────────────────────────────
SECRET_JWT_NAME="${SECRET_JWT_NAME:-prolink/jwt-secret}"
SECRET_SMTP_NAME="${SECRET_SMTP_NAME:-prolink/smtp-password}"

# ─── IAM / ECS ───────────────────────────────────────────────────────────────
ECS_EXECUTION_ROLE_NAME="prolink-ecs-execution-role"
API_TASK_ROLE_NAME="prolink-api-task-role"
WORKER_TASK_ROLE_NAME="prolink-worker-task-role"
ECS_API_LOG_GROUP="/ecs/prolink-api"
ECS_WORKER_LOG_GROUP="/ecs/prolink-worker"
ECS_LOG_RETENTION_DAYS="30"

# ─── ECS — task definitions ──────────────────────────────────────────────────
ECS_API_FAMILY="prolink-api"
ECS_WORKER_FAMILY="prolink-worker"
ECS_CPU="256"
ECS_MEMORY="512"

# Exportadas para que `render_template` (awk via ENVIRON) as enxergue ao
# resolver os placeholders dos templates em iam/ e ecs/.
export DYNAMO_ABERTURA_TABLE DYNAMO_ALTERACAO_TABLE DYNAMO_ACEITES_TABLE
export S3_BUCKET SQS_QUEUE_NAME SQS_DLQ_NAME
export DYNAMO_PK_ATTR DYNAMO_SK_ATTR DYNAMO_TTL_ATTR DYNAMO_BILLING_MODE
export SQS_VISIBILITY_TIMEOUT SQS_RETENTION_SECONDS SQS_DLQ_RETENTION_SECONDS SQS_MAX_RECEIVE_COUNT
export S3_LIFECYCLE_RULE_ID S3_LIFECYCLE_RETENTION_DAYS S3_LIFECYCLE_TAG_KEY S3_LIFECYCLE_TAG_VALUE
export SECRET_JWT_NAME SECRET_SMTP_NAME
export ECS_EXECUTION_ROLE_NAME API_TASK_ROLE_NAME WORKER_TASK_ROLE_NAME
export ECS_API_LOG_GROUP ECS_WORKER_LOG_GROUP ECS_LOG_RETENTION_DAYS
export ECS_API_FAMILY ECS_WORKER_FAMILY ECS_CPU ECS_MEMORY
