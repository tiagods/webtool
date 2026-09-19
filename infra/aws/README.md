# IaC AWS de produção (`infra/aws/`)

Scripts POSIX (`sh`) idempotentes que provisionam os recursos AWS reais via AWS CLI.
Complementam o provisionamento local (`infra/local/init.sh`, Floci) e compartilham os
parâmetros estruturais com ele por meio de `lib/params.sh` (anti-drift).

## Pré-requisitos

- AWS CLI v2 autenticada por **role assumida** (SSO ou `assume-role`). O `lib/common.sh`
  **recusa** identidade de IAM user (`:user/`) — break-glass consciente:
  `PROLINK_ALLOW_IAM_USER=1`.
- `jq` e `awk` no PATH.
- Variáveis: `AWS_REGION` (default `us-east-1`), `PROD_ORIGIN` (CORS), `SMTP_*` e,
  para os taskdefs, `API_IMAGE_URI`/`WORKER_IMAGE_URI`.

> Estes scripts **não** usam `AWS_ENDPOINT_URL` — são a AWS real. Rode a partir de uma
> máquina autenticada com a role de operação.

## Ordem de execução

```sh
export AWS_REGION=us-east-1
export PROD_ORIGIN=https://prolinkcontabil.com.br

./infra/aws/provision-dynamodb.sh   # 3 tabelas + TTL + PITR
./infra/aws/provision-s3.sh         # bucket + block public + SSE + versioning + lifecycle + CORS
./infra/aws/provision-sqs.sh        # fila + DLQ + redrive
./infra/aws/provision-iam.sh        # roles + policies + log groups

# Secrets (valores nunca entram no repo):
JWT_SECRET=... SMTP_PASSWORD=... ./infra/aws/provision-secrets.sh

# Task definitions (exige as imagens já publicadas no ECR):
API_IMAGE_URI=<acct>.dkr.ecr.us-east-1.amazonaws.com/prolink-api:<tag> \
WORKER_IMAGE_URI=<acct>.dkr.ecr.us-east-1.amazonaws.com/prolink-worker:<tag> \
SMTP_HOST=smtp.exemplo.com SMTP_USER=usuario \
  ./infra/aws/register-task-defs.sh
```

Ou tudo de uma vez (pula os taskdefs se as imagens não forem informadas):

```sh
./infra/aws/provision-all.sh
```

Todos os scripts podem ser rodados várias vezes: cada um checa o estado atual
(`describe`/`get`) e decide entre criar e atualizar.

## Layout

| Caminho | Papel |
|---|---|
| `lib/common.sh` | helpers (log, `init_aws`, ARNs, checagens de existência, guard de identidade, `render_template`) |
| `lib/params.sh` | fonte única de nomes e parâmetros estruturais |
| `provision-*.sh` | recursos (DynamoDB, S3, SQS, IAM, Secrets) |
| `register-task-defs.sh` | registra `prolink-api` e `prolink-worker` |
| `provision-all.sh` | encadeia tudo na ordem |
| `iam/*.json` | trust policies e policies inline (placeholders `${...}`) |
| `ecs/*.taskdef.json` | templates das task definitions (placeholders `${...}`) |

## O que NÃO está aqui

Cluster ECS, services Fargate, ALB/TLS, VPC/subnets e o build/push das imagens no ECR
são escopo da spec de rede/deploy (021b). Estes scripts criam apenas recursos, roles,
log groups e as task definitions.
