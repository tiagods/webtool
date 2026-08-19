#!/usr/bin/env bash
# Consulta o bucket S3 do Floci (dev local) — usado quando não há
# camada de visualização disponível para inspecionar uploads/backups.
#
# Uso:
#   ./scripts/test/s3-query.sh list-all
#   ./scripts/test/s3-query.sh list-sessao <sessionId>
#   ./scripts/test/s3-query.sh list-protocolo <protocolo>
#   ./scripts/test/s3-query.sh head-object <key>
#   ./scripts/test/s3-query.sh get-object <key> [destino]

set -euo pipefail

ENDPOINT="${AWS_ENDPOINT_URL:-http://localhost:4566}"
REGION="${AWS_REGION:-us-east-1}"
BUCKET="${AWS_S3_BUCKET:-prolink-fichas}"
AWS="aws --endpoint-url $ENDPOINT --region $REGION"

cmd="${1:-}"

case "$cmd" in
  list-all)
    $AWS s3api list-objects-v2 --bucket "$BUCKET" --output json
    ;;

  list-sessao)
    session_id="${2:?Uso: list-sessao <sessionId>}"
    $AWS s3api list-objects-v2 --bucket "$BUCKET" --prefix "$session_id/" --output json
    ;;

  list-protocolo)
    protocolo="${2:?Uso: list-protocolo <protocolo>}"
    $AWS s3api list-objects-v2 --bucket "$BUCKET" --prefix "protocolos/$protocolo/" --output json
    ;;

  head-object)
    key="${2:?Uso: head-object <key>}"
    echo "▸ Metadata:"
    $AWS s3api head-object --bucket "$BUCKET" --key "$key" --output json
    echo ""
    echo "▸ Tags:"
    $AWS s3api get-object-tagging --bucket "$BUCKET" --key "$key" --output json
    ;;

  get-object)
    key="${2:?Uso: get-object <key> [destino]}"
    destino="${3:-$(basename "$key")}"
    $AWS s3api get-object --bucket "$BUCKET" --key "$key" "$destino" --output json
    echo "Salvo em: $destino"
    ;;

  *)
    echo "Uso: $0 <comando> [args]"
    echo ""
    echo "Comandos:"
    echo "  list-all                              — lista todos os objetos do bucket $BUCKET"
    echo "  list-sessao <sessionId>                — lista objetos em {sessionId}/ (documentos ainda não submetidos)"
    echo "  list-protocolo <protocolo>              — lista objetos em protocolos/{protocolo}/ (backup pós-submit)"
    echo "  head-object <key>                       — metadata + tags de um objeto (ex.: checar tag retention=rascunho)"
    echo "  get-object <key> [destino]               — baixa um objeto para inspeção local (default: nome do arquivo na key)"
    exit 1
    ;;
esac
