#!/usr/bin/env bash
# Consulta as tabelas DynamoDB do Floci (dev local) — usado quando não há
# camada de visualização disponível para inspecionar rascunhos/aceites LGPD.
#
# Uso:
#   ./scripts/test/dynamodb-query.sh scan-rascunhos
#   ./scripts/test/dynamodb-query.sh get-rascunho <sessionId>
#   ./scripts/test/dynamodb-query.sh scan-aceites
#   ./scripts/test/dynamodb-query.sh get-aceite <sessionId> [versaoTermo]

set -euo pipefail

ENDPOINT="${AWS_ENDPOINT_URL:-http://localhost:4566}"
REGION="${AWS_REGION:-us-east-1}"
AWS="aws --endpoint-url $ENDPOINT --region $REGION"

RASCUNHOS_TABLE="fichas-abertura"
ACEITES_TABLE="prolink-aceites-lgpd"

cmd="${1:-}"

case "$cmd" in
  scan-rascunhos)
    $AWS dynamodb scan --table-name "$RASCUNHOS_TABLE" --output json
    ;;

  get-rascunho)
    session_id="${2:?Uso: get-rascunho <sessionId>}"
    $AWS dynamodb get-item \
      --table-name "$RASCUNHOS_TABLE" \
      --key "{\"sessionId\":{\"S\":\"$session_id\"}}" \
      --output json
    ;;

  scan-aceites)
    $AWS dynamodb scan --table-name "$ACEITES_TABLE" --output json
    ;;

  get-aceite)
    session_id="${2:?Uso: get-aceite <sessionId> [versaoTermo]}"
    versao_termo="${3:-v1.0}"
    $AWS dynamodb get-item \
      --table-name "$ACEITES_TABLE" \
      --key "{\"sessionId\":{\"S\":\"$session_id\"},\"versaoTermo\":{\"S\":\"$versao_termo\"}}" \
      --output json
    ;;

  *)
    echo "Uso: $0 <comando> [args]"
    echo ""
    echo "Comandos:"
    echo "  scan-rascunhos                       — lista todos os itens da tabela $RASCUNHOS_TABLE"
    echo "  get-rascunho <sessionId>              — busca um rascunho específico"
    echo "  scan-aceites                          — lista todos os itens da tabela $ACEITES_TABLE"
    echo "  get-aceite <sessionId> [versaoTermo]  — busca um aceite específico (default versaoTermo=v1.0)"
    exit 1
    ;;
esac
