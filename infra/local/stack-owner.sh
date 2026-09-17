#!/usr/bin/env bash
# Diz qual worktree e dona da stack Docker local (uma por maquina: os
# container_name sao globais no daemon).
# Uso: ./infra/local/stack-owner.sh [--guard]
#   sem flag  - imprime o dono e sai 0
#   --guard   - sai 1 se a stack pertence a OUTRO diretorio

set -euo pipefail

SENTINELA="prolink-floci"   # primeiro container a subir; representa a stack

ok()   { echo "  ✅ $1"; }
warn() { echo "  ⚠️  $1"; }
fail() { echo "  ❌ $1"; }

# Normaliza para comparar caminhos entre Git Bash (/c/...), MSYS (C:/...) e Linux.
normaliza() {
  printf '%s' "$1" | tr -d '\r' | tr '\\' '/' | tr 'A-Z' 'a-z' \
    | sed -E 's#^/([a-z])/#\1:/#' | sed -E 's#/+$##'
}

GUARD=false
[ "${1:-}" = "--guard" ] && GUARD=true

# Docker ausente ou parado nao e problema deste script: deixa o erro real
# vir do proprio compose.
if ! command -v docker > /dev/null 2>&1; then
  $GUARD || warn "docker nao encontrado no PATH"
  exit 0
fi
if ! docker info > /dev/null 2>&1; then
  $GUARD || warn "daemon Docker nao esta respondendo"
  exit 0
fi

# Container parado ainda ocupa o nome, entao `inspect` (e nao `ps`) e o que
# determina se a stack esta tomada.
ESTADO="$(docker inspect "$SENTINELA" \
  --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}|{{.State.Running}}' 2>/dev/null || true)"

if [ -z "$ESTADO" ]; then
  $GUARD || ok "stack livre — nenhum container $SENTINELA no daemon"
  exit 0
fi

DONO="${ESTADO%|*}"
[ "${ESTADO##*|}" = "true" ] && SITUACAO="de pe" || SITUACAO="parada, ocupando os nomes"

AQUI="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

if [ "$(normaliza "$DONO")" = "$(normaliza "$AQUI")" ]; then
  $GUARD || ok "stack $SITUACAO, dona: esta worktree ($AQUI)"
  exit 0
fi

if $GUARD; then
  echo ""
  fail "stack Docker ($SITUACAO) pertence a OUTRA worktree"
  echo "     dona: $DONO"
  echo "     aqui: $AQUI"
  echo ""
  echo "  A stack e uma so por maquina (container_name e portas sao fixos)."
  echo "  Opcoes: usar a stack como esta, ou liberar a maquina com"
  echo "    npm run infra:down   # rodado a partir de $DONO"
  echo ""
  exit 1
fi

warn "stack $SITUACAO, dona: $DONO (outra worktree)"
exit 0
