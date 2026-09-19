#!/usr/bin/env sh
# Provisiona as tabelas DynamoDB de produção de forma idempotente.
#
# Recursos:
#   - fichas-abertura       PK sessionId (S)
#   - fichas-alteracao      PK sessionId (S)
#   - prolink-aceites-lgpd  PK sessionId (S) + SK versaoTermo (S)
# Todas em PAY_PER_REQUEST, com TTL no atributo `ttl` e Point-in-Time Recovery
# habilitado. Se a tabela já existe, apenas garante TTL/PITR (não recria).
#
# Uso: AWS_REGION=us-east-1 ./infra/aws/provision-dynamodb.sh

set -eu

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
# shellcheck source=infra/aws/lib/common.sh
. "$SCRIPT_DIR/lib/common.sh"
# shellcheck source=infra/aws/lib/params.sh
. "$SCRIPT_DIR/lib/params.sh"

init_aws

log "DynamoDB — região $REGION, conta $ACCOUNT_ID"

create_table_if_missing() {
  table="$1"
  shift

  if dynamo_table_exists "$table"; then
    log "  $table: já existe"
  else
    log "  $table: criando..."
    aws_r dynamodb create-table \
      --table-name "$table" \
      --billing-mode "$DYNAMO_BILLING_MODE" \
      "$@" \
      --query 'TableDescription.TableName' \
      --output text >/dev/null
  fi
}

enable_ttl_and_pitr() {
  table="$1"

  aws_r dynamodb update-time-to-live \
    --table-name "$table" \
    --time-to-live-specification "Enabled=true,AttributeName=$DYNAMO_TTL_ATTR" \
    >/dev/null

  aws_r dynamodb update-continuous-backups \
    --table-name "$table" \
    --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
    >/dev/null

  log "  $table: TTL ($DYNAMO_TTL_ATTR) + PITR ok"
}

create_table_if_missing "$DYNAMO_ABERTURA_TABLE" \
  --attribute-definitions "AttributeName=$DYNAMO_PK_ATTR,AttributeType=S" \
  --key-schema "AttributeName=$DYNAMO_PK_ATTR,KeyType=HASH"
enable_ttl_and_pitr "$DYNAMO_ABERTURA_TABLE"

create_table_if_missing "$DYNAMO_ALTERACAO_TABLE" \
  --attribute-definitions "AttributeName=$DYNAMO_PK_ATTR,AttributeType=S" \
  --key-schema "AttributeName=$DYNAMO_PK_ATTR,KeyType=HASH"
enable_ttl_and_pitr "$DYNAMO_ALTERACAO_TABLE"

create_table_if_missing "$DYNAMO_ACEITES_TABLE" \
  --attribute-definitions "AttributeName=$DYNAMO_PK_ATTR,AttributeType=S" "AttributeName=$DYNAMO_SK_ATTR,AttributeType=S" \
  --key-schema "AttributeName=$DYNAMO_PK_ATTR,KeyType=HASH" "AttributeName=$DYNAMO_SK_ATTR,KeyType=RANGE"
enable_ttl_and_pitr "$DYNAMO_ACEITES_TABLE"

log "DynamoDB: pronto."
