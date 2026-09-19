#!/usr/bin/env sh
# Helpers compartilhados pelos scripts de provisionamento contra a AWS real
# (infra/aws/provision-*.sh). POSIX sh, sem bashismos.
#
# Não rode direto: use `. "$SCRIPT_DIR/lib/common.sh"` no início do script.
# Depende de `aws` (AWS CLI v2) e `jq`; `init_aws` valida ambos.

# ─── Saída e erro ────────────────────────────────────────────────────────────
log() { printf '%s\n' "$*"; }
warn() { printf 'AVISO: %s\n' "$*" >&2; }
die() { printf 'ERRO: %s\n' "$*" >&2; exit 1; }

# ─── Dependências ────────────────────────────────────────────────────────────
require_cmd() {
  for cmd in "$@"; do
    command -v "$cmd" >/dev/null 2>&1 || die "comando obrigatório não encontrado: $cmd"
  done
}

# ─── Região ──────────────────────────────────────────────────────────────────
# AWS_REGION tem precedência sobre AWS_DEFAULT_REGION; default us-east-1.
resolve_region() {
  printf '%s' "${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
}

# ─── Guard: somente IAM Role, nunca IAM user ─────────────────────────────────
# O runtime usa Task Role e o `apply` deve usar role assumida (SSO/assume-role).
# Recusa identidades `:user/` — break-glass consciente via PROLINK_ALLOW_IAM_USER=1.
assert_role_identity() {
  caller_arn=$(aws sts get-caller-identity --query Arn --output text)

  case "$caller_arn" in
    *:user/*)
      if [ "${PROLINK_ALLOW_IAM_USER:-0}" = "1" ]; then
        warn "executando como IAM user ($caller_arn) — PROLINK_ALLOW_IAM_USER=1"
      else
        die "identidade é um IAM user ($caller_arn); use role assumida (SSO/assume-role) ou PROLINK_ALLOW_IAM_USER=1 (break-glass)"
      fi
      ;;
    *)
      log "Identidade: $caller_arn"
      ;;
  esac
}

# ─── Inicialização comum ─────────────────────────────────────────────────────
# Valida dependências, aplica o guard de identidade e resolve REGION/ACCOUNT_ID.
# Depois disso, os scripts usam `aws_r` (AWS CLI já com --region).
init_aws() {
  require_cmd aws jq
  assert_role_identity

  REGION="$(resolve_region)"
  ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
  export REGION ACCOUNT_ID
}

# Wrapper do AWS CLI com a região resolvida (evita repetir --region).
aws_r() { aws --region "$REGION" "$@"; }

# ─── Montagem de ARNs ────────────────────────────────────────────────────────
dynamo_arn() { printf 'arn:aws:dynamodb:%s:%s:table/%s' "$REGION" "$ACCOUNT_ID" "$1"; }
sqs_arn() { printf 'arn:aws:sqs:%s:%s:%s' "$REGION" "$ACCOUNT_ID" "$1"; }
s3_bucket_arn() { printf 'arn:aws:s3:::%s' "$1"; }
s3_objects_arn() { printf 'arn:aws:s3:::%s/*' "$1"; }
role_arn() { printf 'arn:aws:iam::%s:role/%s' "$ACCOUNT_ID" "$1"; }
# O sufixo aleatório do Secrets Manager é coberto por `-*` (não é Resource: "*").
secret_arn() { printf 'arn:aws:secretsmanager:%s:%s:secret:%s-*' "$REGION" "$ACCOUNT_ID" "$1"; }

# ─── Idempotência — recursos existentes ──────────────────────────────────────
dynamo_table_exists() { aws_r dynamodb describe-table --table-name "$1" >/dev/null 2>&1; }
s3_bucket_exists() { aws_r s3api head-bucket --bucket "$1" >/dev/null 2>&1; }
sqs_queue_exists() { aws_r sqs get-queue-url --queue-name "$1" >/dev/null 2>&1; }
iam_role_exists() { aws_r iam get-role --role-name "$1" >/dev/null 2>&1; }
secret_exists() { aws_r secretsmanager describe-secret --secret-id "$1" >/dev/null 2>&1; }
log_group_exists() { aws_r logs describe-log-groups --log-group-name-prefix "$1" \
  --query "logGroups[?logGroupName=='$1'] | length(@)" --output text 2>/dev/null | grep -q '^1$'; }
