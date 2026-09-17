#!/usr/bin/env sh
# Provisiona recursos AWS locais no Floci via AWS CLI
# Executado pelo container aws-init após o Floci estar saudável

set -eu

ENDPOINT="${AWS_ENDPOINT_URL:-http://localhost:4566}"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"
AWS="aws --endpoint-url $ENDPOINT --region $REGION"

echo "✅ Floci disponível em $ENDPOINT. Provisionando recursos..."

# ─── DynamoDB ────────────────────────────────────────────────────────────────
echo "📦 Criando tabela DynamoDB: fichas-abertura..."
$AWS dynamodb create-table \
  --table-name fichas-abertura \
  --attribute-definitions AttributeName=sessionId,AttributeType=S \
  --key-schema AttributeName=sessionId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --query 'TableDescription.TableName' \
  --output text 2>/dev/null || echo "  (tabela já existe)"

$AWS dynamodb update-time-to-live \
  --table-name fichas-abertura \
  --time-to-live-specification "Enabled=true,AttributeName=ttl" \
  >/dev/null 2>&1 || true

echo "✅ DynamoDB: fichas-abertura pronta."

echo "📦 Criando tabela DynamoDB: fichas-alteracao..."
$AWS dynamodb create-table \
  --table-name fichas-alteracao \
  --attribute-definitions AttributeName=sessionId,AttributeType=S \
  --key-schema AttributeName=sessionId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --query 'TableDescription.TableName' \
  --output text 2>/dev/null || echo "  (tabela já existe)"

$AWS dynamodb update-time-to-live \
  --table-name fichas-alteracao \
  --time-to-live-specification "Enabled=true,AttributeName=ttl" \
  >/dev/null 2>&1 || true

echo "✅ DynamoDB: fichas-alteracao pronta."

echo "📦 Criando tabela DynamoDB: prolink-aceites-lgpd..."
$AWS dynamodb create-table \
  --table-name prolink-aceites-lgpd \
  --attribute-definitions AttributeName=sessionId,AttributeType=S AttributeName=versaoTermo,AttributeType=S \
  --key-schema AttributeName=sessionId,KeyType=HASH AttributeName=versaoTermo,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --query 'TableDescription.TableName' \
  --output text 2>/dev/null || echo "  (tabela já existe)"

$AWS dynamodb update-time-to-live \
  --table-name prolink-aceites-lgpd \
  --time-to-live-specification "Enabled=true,AttributeName=ttl" \
  >/dev/null 2>&1 || true

echo "✅ DynamoDB: prolink-aceites-lgpd pronta."

# ─── S3 ──────────────────────────────────────────────────────────────────────
echo "🪣 Criando bucket S3: prolink-fichas..."
$AWS s3 mb s3://prolink-fichas 2>/dev/null || echo "  (bucket já existe)"

$AWS s3api put-bucket-cors \
  --bucket prolink-fichas \
  --cors-configuration '{"CORSRules":[{"AllowedOrigins":["http://localhost:3000"],"AllowedMethods":["PUT","HEAD"],"AllowedHeaders":["Content-Type","Content-Length","x-amz-*"],"ExposeHeaders":["ETag"],"MaxAgeSeconds":3000}]}' \
  >/dev/null 2>&1 || true

# Deleta objetos de sessões abandonadas (nunca submetidas) após 30 dias — LGPD Art. 16.
# Filtro por TAG (não por prefixo): objetos de rascunho são gravados com a tag
# "retention=rascunho" (ver getPresignedUploadUrl em lib/aws/s3.ts); no submit, o copyObject
# para protocolos/{protocolo}/ remove essa tag (TaggingDirective=REPLACE), então os backups
# finais NUNCA são alcançados por esta regra. Um filtro por Prefix:"" (bucket inteiro)
# apagaria também os backups em protocolos/ — por isso o filtro é por tag, não por prefixo.
$AWS s3api put-bucket-lifecycle-configuration \
  --bucket prolink-fichas \
  --lifecycle-configuration '{"Rules":[{"ID":"delete-rascunhos-abandonados","Filter":{"Tag":{"Key":"retention","Value":"rascunho"}},"Status":"Enabled","Expiration":{"Days":30}}]}' \
  >/dev/null 2>&1 || true

echo "✅ S3: prolink-fichas pronto."

# ─── SQS ─────────────────────────────────────────────────────────────────────
echo "📬 Criando fila SQS: prolink-abertura..."
QUEUE_URL=$($AWS sqs create-queue \
  --queue-name prolink-abertura \
  --attributes '{"VisibilityTimeout":"120","MessageRetentionPeriod":"86400"}' \
  --query 'QueueUrl' \
  --output text 2>/dev/null) || echo "  (fila já existe)"

echo "📬 Criando DLQ: prolink-abertura-dlq..."
DLQ_URL=$($AWS sqs create-queue \
  --queue-name prolink-abertura-dlq \
  --attributes '{"MessageRetentionPeriod":"1209600"}' \
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
    --attributes "{\"RedrivePolicy\":\"{\\\"deadLetterTargetArn\\\":\\\"$DLQ_ARN\\\",\\\"maxReceiveCount\\\":\\\"5\\\"}\"}" \
    >/dev/null 2>&1 || echo "  (RedrivePolicy já configurada)"
fi

echo "✅ SQS: prolink-abertura + DLQ prontas."

# ─── SNS ─────────────────────────────────────────────────────────────────────
echo "📣 Criando tópico SNS: prolink-abertura-emails..."
TOPIC_ARN=$($AWS sns create-topic \
  --name prolink-abertura-emails \
  --query 'TopicArn' \
  --output text 2>/dev/null) || echo "  (tópico já existe)"

echo "✅ SNS: prolink-abertura-emails pronto."
echo "   ARN: $TOPIC_ARN"

# ─── SES ─────────────────────────────────────────────────────────────────────
echo "📧 Verificando identidade SES e subscription SNS..."
$AWS ses verify-email-identity \
  --email-address contato@prolinkcontabil.com.br \
  >/dev/null 2>&1 || true

# Inscrever o endereço SES como subscription do tópico SNS
$AWS sns subscribe \
  --topic-arn "$TOPIC_ARN" \
  --protocol email \
  --notification-endpoint contato@prolinkcontabil.com.br \
  >/dev/null 2>&1 || true

echo "✅ SES: contato@prolinkcontabil.com.br inscrito no SNS."

# ─── Resumo ──────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════"
echo " Recursos provisionados com sucesso"
echo "════════════════════════════════════════════"
echo " DynamoDB : fichas-abertura (TTL: ttl)"
echo " DynamoDB : fichas-alteracao (TTL: ttl)"
echo " DynamoDB : prolink-aceites-lgpd (TTL: ttl)"
echo " S3       : prolink-fichas  (CORS: localhost:3000)"
echo " SQS      : prolink-abertura"
echo " SNS      : prolink-abertura-emails"
echo " SES      : contato@prolinkcontabil.com.br (SNS subscription)"
echo " Endpoint : $ENDPOINT"
echo "════════════════════════════════════════════"
