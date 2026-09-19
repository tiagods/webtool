#!/usr/bin/env sh
# Provisiona recursos AWS locais no Floci via AWS CLI
# Executado pelo container aws-init após o Floci estar saudável
#
# Os nomes e parâmetros estruturais vêm de infra/aws/lib/params.sh (fonte única
# compartilhada com os scripts de produção) — ver "Anti-drift" na spec 021.

set -eu

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
if [ -f "$SCRIPT_DIR/../aws/lib/params.sh" ]; then
  # shellcheck source=infra/aws/lib/params.sh
  . "$SCRIPT_DIR/../aws/lib/params.sh"
elif [ -f /params.sh ]; then
  # shellcheck source=/dev/null
  . /params.sh
else
  echo "ERRO: infra/aws/lib/params.sh não encontrado" >&2
  exit 1
fi

ENDPOINT="${AWS_ENDPOINT_URL:-http://localhost:4566}"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"
AWS="aws --endpoint-url $ENDPOINT --region $REGION"

echo "✅ Floci disponível em $ENDPOINT. Provisionando recursos..."

# ─── DynamoDB ────────────────────────────────────────────────────────────────
echo "📦 Criando tabela DynamoDB: $DYNAMO_ABERTURA_TABLE..."
$AWS dynamodb create-table \
  --table-name "$DYNAMO_ABERTURA_TABLE" \
  --attribute-definitions "AttributeName=$DYNAMO_PK_ATTR,AttributeType=S" \
  --key-schema "AttributeName=$DYNAMO_PK_ATTR,KeyType=HASH" \
  --billing-mode "$DYNAMO_BILLING_MODE" \
  --query 'TableDescription.TableName' \
  --output text 2>/dev/null || echo "  (tabela já existe)"

$AWS dynamodb update-time-to-live \
  --table-name "$DYNAMO_ABERTURA_TABLE" \
  --time-to-live-specification "Enabled=true,AttributeName=$DYNAMO_TTL_ATTR" \
  >/dev/null 2>&1 || true

echo "✅ DynamoDB: $DYNAMO_ABERTURA_TABLE pronta."

echo "📦 Criando tabela DynamoDB: $DYNAMO_ALTERACAO_TABLE..."
$AWS dynamodb create-table \
  --table-name "$DYNAMO_ALTERACAO_TABLE" \
  --attribute-definitions "AttributeName=$DYNAMO_PK_ATTR,AttributeType=S" \
  --key-schema "AttributeName=$DYNAMO_PK_ATTR,KeyType=HASH" \
  --billing-mode "$DYNAMO_BILLING_MODE" \
  --query 'TableDescription.TableName' \
  --output text 2>/dev/null || echo "  (tabela já existe)"

$AWS dynamodb update-time-to-live \
  --table-name "$DYNAMO_ALTERACAO_TABLE" \
  --time-to-live-specification "Enabled=true,AttributeName=$DYNAMO_TTL_ATTR" \
  >/dev/null 2>&1 || true

echo "✅ DynamoDB: $DYNAMO_ALTERACAO_TABLE pronta."

echo "📦 Criando tabela DynamoDB: $DYNAMO_ACEITES_TABLE..."
$AWS dynamodb create-table \
  --table-name "$DYNAMO_ACEITES_TABLE" \
  --attribute-definitions "AttributeName=$DYNAMO_PK_ATTR,AttributeType=S" "AttributeName=$DYNAMO_SK_ATTR,AttributeType=S" \
  --key-schema "AttributeName=$DYNAMO_PK_ATTR,KeyType=HASH" "AttributeName=$DYNAMO_SK_ATTR,KeyType=RANGE" \
  --billing-mode "$DYNAMO_BILLING_MODE" \
  --query 'TableDescription.TableName' \
  --output text 2>/dev/null || echo "  (tabela já existe)"

$AWS dynamodb update-time-to-live \
  --table-name "$DYNAMO_ACEITES_TABLE" \
  --time-to-live-specification "Enabled=true,AttributeName=$DYNAMO_TTL_ATTR" \
  >/dev/null 2>&1 || true

echo "✅ DynamoDB: $DYNAMO_ACEITES_TABLE pronta."

# ─── S3 ──────────────────────────────────────────────────────────────────────
echo "🪣 Criando bucket S3: $S3_BUCKET..."
$AWS s3 mb "s3://$S3_BUCKET" 2>/dev/null || echo "  (bucket já existe)"

$AWS s3api put-bucket-cors \
  --bucket "$S3_BUCKET" \
  --cors-configuration '{"CORSRules":[{"AllowedOrigins":["http://localhost:3000"],"AllowedMethods":["PUT","HEAD"],"AllowedHeaders":["Content-Type","Content-Length","x-amz-*"],"ExposeHeaders":["ETag"],"MaxAgeSeconds":3000}]}' \
  >/dev/null 2>&1 || true

# Deleta objetos de sessões abandonadas (nunca submetidas) após 30 dias — LGPD Art. 16.
# Filtro por TAG (não por prefixo): objetos de rascunho são gravados com a tag
# "retention=rascunho" (ver PresignedUploadURL em apps/backend/infrastructure/aws/s3.go); no submit, o copyObject
# para protocolos/{protocolo}/ remove essa tag (TaggingDirective=REPLACE), então os backups
# finais NUNCA são alcançados por esta regra. Um filtro por Prefix:"" (bucket inteiro)
# apagaria também os backups em protocolos/ — por isso o filtro é por tag, não por prefixo.
LIFECYCLE=$(printf '{"Rules":[{"ID":"%s","Filter":{"Tag":{"Key":"%s","Value":"%s"}},"Status":"Enabled","Expiration":{"Days":%s}}]}' \
  "$S3_LIFECYCLE_RULE_ID" "$S3_LIFECYCLE_TAG_KEY" "$S3_LIFECYCLE_TAG_VALUE" "$S3_LIFECYCLE_RETENTION_DAYS")
$AWS s3api put-bucket-lifecycle-configuration \
  --bucket "$S3_BUCKET" \
  --lifecycle-configuration "$LIFECYCLE" \
  >/dev/null 2>&1 || true

echo "✅ S3: $S3_BUCKET pronto."

# ─── SQS ─────────────────────────────────────────────────────────────────────
echo "📬 Criando fila SQS: $SQS_QUEUE_NAME..."
QUEUE_URL=$($AWS sqs create-queue \
  --queue-name "$SQS_QUEUE_NAME" \
  --attributes "{\"VisibilityTimeout\":\"$SQS_VISIBILITY_TIMEOUT\",\"MessageRetentionPeriod\":\"$SQS_RETENTION_SECONDS\"}" \
  --query 'QueueUrl' \
  --output text 2>/dev/null) || echo "  (fila já existe)"

echo "📬 Criando DLQ: $SQS_DLQ_NAME..."
DLQ_URL=$($AWS sqs create-queue \
  --queue-name "$SQS_DLQ_NAME" \
  --attributes "{\"MessageRetentionPeriod\":\"$SQS_DLQ_RETENTION_SECONDS\"}" \
  --query 'QueueUrl' \
  --output text 2>/dev/null) || echo "  (DLQ já existe)"

# Obter ARN da DLQ
DLQ_ARN=$($AWS sqs get-queue-attributes \
  --queue-url "$DLQ_URL" \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' \
  --output text 2>/dev/null || echo "")

# Configurar RedrivePolicy na fila principal (após 5 falhas → DLQ)
if [ -n "$DLQ_ARN" ]; then
  $AWS sqs set-queue-attributes \
    --queue-url "$QUEUE_URL" \
    --attributes "{\"RedrivePolicy\":\"{\\\"deadLetterTargetArn\\\":\\\"$DLQ_ARN\\\",\\\"maxReceiveCount\\\":\\\"$SQS_MAX_RECEIVE_COUNT\\\"}\"}" \
    >/dev/null 2>&1 || echo "  (RedrivePolicy já configurada)"
fi

echo "✅ SQS: $SQS_QUEUE_NAME + $SQS_DLQ_NAME prontas."

# ─── Resumo ──────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════"
echo " Recursos provisionados com sucesso"
echo "════════════════════════════════════════════"
echo " DynamoDB : $DYNAMO_ABERTURA_TABLE (TTL: $DYNAMO_TTL_ATTR)"
echo " DynamoDB : $DYNAMO_ALTERACAO_TABLE (TTL: $DYNAMO_TTL_ATTR)"
echo " DynamoDB : $DYNAMO_ACEITES_TABLE (TTL: $DYNAMO_TTL_ATTR)"
echo " S3       : $S3_BUCKET  (CORS: localhost:3000)"
echo " SQS      : $SQS_QUEUE_NAME"
echo " Endpoint : $ENDPOINT"
echo "════════════════════════════════════════════"
