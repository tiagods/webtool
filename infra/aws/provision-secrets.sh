#!/usr/bin/env sh
# Cria/atualiza os secrets de produção no AWS Secrets Manager (idempotente).
#
#   prolink/jwt-secret     — segredo de assinatura do JWT (web + api)
#   prolink/smtp-password  — senha do servidor SMTP (worker)
#
# Os valores NUNCA entram no repositório: vêm das variáveis de ambiente
# JWT_SECRET / SMTP_PASSWORD do operador. Se o JWT_SECRET não existir ainda e
# nenhum valor for informado, um novo é gerado com `openssl rand -base64 32` e
# impresso UMA única vez — guarde-o. Para um secret já existente sem valor novo
# informado, nada é alterado.
#
# Uso: JWT_SECRET=... SMTP_PASSWORD=... ./infra/aws/provision-secrets.sh

set -eu

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
# shellcheck source=infra/aws/lib/common.sh
. "$SCRIPT_DIR/lib/common.sh"
# shellcheck source=infra/aws/lib/params.sh
. "$SCRIPT_DIR/lib/params.sh"

init_aws

log "Secrets Manager — região $REGION, conta $ACCOUNT_ID"

set_secret() {
  name="$1"
  value="$2"

  if secret_exists "$name"; then
    if [ -n "$value" ]; then
      aws_r secretsmanager put-secret-value \
        --secret-id "$name" \
        --secret-string "$value" >/dev/null
      log "  $name: valor atualizado"
    else
      log "  $name: já existe (nenhum valor novo informado)"
    fi
  else
    aws_r secretsmanager create-secret \
      --name "$name" \
      --secret-string "$value" >/dev/null
    log "  $name: criado"
  fi
}

# ─── JWT_SECRET ──────────────────────────────────────────────────────────────
jwt="${JWT_SECRET:-}"
if [ -z "$jwt" ] && ! secret_exists "$SECRET_JWT_NAME"; then
  require_cmd openssl
  jwt=$(openssl rand -base64 32)
  log "  JWT_SECRET gerado (guarde agora — não será exibido novamente):"
  log "  $jwt"
fi
set_secret "$SECRET_JWT_NAME" "$jwt"

# ─── SMTP_PASSWORD ───────────────────────────────────────────────────────────
smtp="${SMTP_PASSWORD:-}"
if [ -z "$smtp" ] && ! secret_exists "$SECRET_SMTP_NAME"; then
  die "SMTP_PASSWORD é obrigatória para criar $SECRET_SMTP_NAME"
fi
set_secret "$SECRET_SMTP_NAME" "$smtp"

log "Secrets: prontos."
