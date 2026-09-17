#!/usr/bin/env bash
# Derruba a stack Docker local respeitando o dono (ver stack-owner.sh).
# Uso: ./infra/local/stack-down.sh [args extras do docker compose down]
#
# O projeto Compose vem do nome do diretorio, entao um `down` disparado de uma
# worktree miraria o projeto errado e nao removeria os prolink-*. Daqui o
# projeto do dono vai explicito no -p.

set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OWNER="$AQUI/stack-owner.sh"

bash "$OWNER" --guard-down

PROJETO="$(bash "$OWNER" --projeto)"

if [ -z "$PROJETO" ]; then
  echo "  ✅ nada para derrubar — stack livre"
  exit 0
fi

docker compose -p "$PROJETO" down "$@"
