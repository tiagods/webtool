#!/usr/bin/env sh
# Compat: o CORS de produção passou a ser aplicado por provision-s3.sh (spec 021),
# que também garante Block Public Access, SSE-S3, Versioning e Lifecycle.
# Este wrapper existe para não quebrar referências antigas (ex.: deploy.md).
#
# Uso: PROD_ORIGIN=https://prolinkcontabil.com.br ./infra/aws/set-cors-producao.sh

set -eu

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
exec "$SCRIPT_DIR/provision-s3.sh"
