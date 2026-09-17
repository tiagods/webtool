#!/usr/bin/env bash
# Diz qual worktree e dona da stack Docker local (uma por maquina: os
# container_name sao globais no daemon). Pura consulta — nao tem efeito
# colateral; quem age e o stack-down.sh.
# Uso: ./infra/local/stack-owner.sh [--guard | --guard-down | --projeto]
#   sem flag      - imprime o dono e sai 0
#   --guard       - sai 1 se a stack pertence a OUTRO diretorio (para subir,
#                   os nomes precisam estar livres, parada ou no ar)
#   --guard-down  - sai 1 so se a stack alheia estiver NO AR; parada e lixo
#                   ocupando nome, qualquer worktree pode limpar
#   --projeto     - imprime o nome do projeto Compose dono (para o `-p`)

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

MODO="${1:-relatorio}"
case "$MODO" in
  relatorio|--guard|--guard-down|--projeto) ;;
  *) fail "modo desconhecido: $MODO"; exit 2 ;;
esac

# Silencia a saida decorativa quando o chamador quer so o valor ou o exit code.
mudo() { [ "$MODO" != "relatorio" ]; }

# Docker ausente ou parado nao e problema deste script: deixa o erro real
# vir do proprio compose.
if ! command -v docker > /dev/null 2>&1; then
  mudo || warn "docker nao encontrado no PATH"
  exit 0
fi
if ! docker info > /dev/null 2>&1; then
  mudo || warn "daemon Docker nao esta respondendo"
  exit 0
fi

# Container parado ainda ocupa o nome, entao `inspect` (e nao `ps`) e o que
# determina se a stack esta tomada.
ESTADO="$(docker inspect "$SENTINELA" --format \
  '{{index .Config.Labels "com.docker.compose.project.working_dir"}}|{{index .Config.Labels "com.docker.compose.project"}}|{{.State.Running}}' \
  2>/dev/null || true)"

if [ -z "$ESTADO" ]; then
  mudo || ok "stack livre — nenhum container $SENTINELA no daemon"
  exit 0
fi

IFS='|' read -r DONO PROJETO RODANDO <<< "$ESTADO"
[ "$RODANDO" = "true" ] && SITUACAO="de pe" || SITUACAO="parada, ocupando os nomes"

if [ "$MODO" = "--projeto" ]; then
  printf '%s\n' "$PROJETO"
  exit 0
fi

AQUI="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

if [ "$(normaliza "$DONO")" = "$(normaliza "$AQUI")" ]; then
  mudo || ok "stack $SITUACAO, dona: esta worktree ($AQUI)"
  exit 0
fi

# Stack alheia parada e lixo: liberar os nomes nao interrompe ninguem.
if [ "$MODO" = "--guard-down" ] && [ "$RODANDO" != "true" ]; then
  warn "limpando stack parada da worktree $DONO (projeto $PROJETO)"
  exit 0
fi

if [ "$MODO" = "--guard" ] || [ "$MODO" = "--guard-down" ]; then
  echo ""
  fail "stack Docker ($SITUACAO) pertence a OUTRA worktree"
  echo "     dona: $DONO"
  echo "     aqui: $AQUI"
  echo ""
  if [ "$RODANDO" = "true" ]; then
    echo "  Ela esta em uso. A decisao de derrubar e do usuario:"
    echo "    npm run infra:down   # rodado a partir de $DONO"
  else
    echo "  Os nomes estao ocupados por containers parados. Libere com:"
    echo "    npm run infra:down"
  fi
  echo ""
  exit 1
fi

warn "stack $SITUACAO, dona: $DONO (outra worktree)"
exit 0
