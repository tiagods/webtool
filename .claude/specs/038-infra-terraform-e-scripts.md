---
id: "038"
title: "Infra como Terraform (local + production) e nginx em scripts/"
status: approved
created: 2026-10-05
author: "Tiago"
batch_size: "medium"
depends_on: ["037"]    # 037 renomeia os recursos em infra/aws/lib/params.sh — a 038 nasce com os nomes novos
prefer_after: []
touches:
  - "infra/**"
  - "scripts/terraform/**"
  - "scripts/nginx/**"
  - "docker-compose.yml"
  - "docker-compose.prod.yml"
  - "package.json"
  - ".gitignore"
  - "CLAUDE.md"
  - "README.md"
  - "deploy.md"
  - "docs/aws.md"
  - "docs/arquitetura.md"
  - ".claude/commands/start-batch.md"
  - ".claude/commands/done.md"
  - ".claude/specs/038-*.md"
---

# Infra como Terraform (local + production) e nginx em scripts/

## Contexto

Toda a criação de infraestrutura vive hoje na pasta `infra/`, como shell imperativo sobre a
AWS CLI:

- **`infra/aws/`** — produção: scripts `provision-*.sh` e templates JSON com placeholders
  `${...}` resolvidos por `awk` (`lib/common.sh`).
- **`infra/local/init.sh`** — local: recria as 3 tabelas DynamoDB, o bucket S3 (CORS +
  lifecycle) e a fila SQS + DLQ + redrive no Floci, executado pelo container `aws-init` do
  `docker-compose.yml`.
- **`infra/aws/lib/params.sh`** — "fonte única" de nomes e parâmetros, compartilhada pelos
  dois lados via `source` para evitar drift (spec 021).
- **`infra/nginx/`** — `Dockerfile` + `default.conf` do reverse proxy, que não é provisionamento
  de AWS e só está em `infra/` por histórico.

Problemas dessa forma:

- **Idempotência feita à mão** — cada script faz `describe`/`get` e decide entre criar e
  atualizar; o `init.sh` local simplesmente engole erro (`|| true`, `2>/dev/null`), então uma
  falha real de provisionamento passa por "já existe".
- **Sem plano nem detecção de drift** — não há como ver o que vai mudar antes de aplicar, nem
  saber se a AWS real divergiu do repositório.
- **Anti-drift local × produção por convenção** — depende de todo script lembrar de fazer
  `source` do `params.sh`.
- **Duas implementações do mesmo recurso** — `init.sh` e `provision-*.sh` descrevem as mesmas
  tabelas/fila/bucket com código diferente.

## Objetivo

Criar a infraestrutura em **Terraform**, com dois root modules, e tirar o nginx de `infra/`:

1. **`scripts/terraform/local/`** — provisiona no **Floci**: 3 tabelas DynamoDB, bucket S3
   (CORS + lifecycle) e fila SQS + DLQ. Passa a ser o que o `aws-init` do
   `docker-compose.yml` executa.
2. **`scripts/terraform/production/`** — provisiona na **AWS real**: as mesmas tabelas (com
   TTL + PITR), o bucket (block public access, SSE, versioning, lifecycle, CORS), a fila + DLQ
   e a **IAM role** da aplicação com menor privilégio sobre esses recursos.
3. **`infra/nginx/` → `scripts/nginx/`** — move sem alterar conteúdo; atualiza o `build.context`
   nos dois compose.
4. **Remover `infra/`** ao final, atualizando todos os consumidores (compose, `package.json`,
   docs).

Tabelas, bucket e filas devem sair **iguais** aos de hoje (nomes, schema, atributos).

## Fora de escopo

- **Renomear recursos** — é a spec 037 (`depends_on`).
- **CI rodando `terraform plan/apply`** — a execução é manual e local.
- **Backend remoto de state**.
- **Mudanças em `apps/backend` e `apps/web`** — nenhuma env var ou contrato muda.
- **Specs passadas** — referências a `infra/` em `.claude/specs/0NN-*.md` não são reescritas.

## Design

### Layout

```
scripts/
├── nginx/                      # movido de infra/nginx (Dockerfile, default.conf)
└── terraform/
    ├── modules/
    │   └── dados/              # DynamoDB + S3 + SQS — compartilhado por local e production
    ├── local/                  # provider apontado para o Floci; terraform.tfstate aqui (gitignorado)
    │   └── main.tf  providers.tf  variables.tf  outputs.tf
    └── production/             # AWS real; terraform.tfstate aqui (gitignorado)
        └── main.tf  providers.tf  variables.tf  outputs.tf  iam.tf
```

O módulo `modules/dados` substitui o `params.sh` como mecanismo anti-drift: local e production
instanciam **o mesmo código**, e o que difere entra por variável (origem do CORS, PITR, SSE,
versioning, block public access).

### Camadas afetadas

| Camada | Arquivo | Ação |
|--------|---------|------|
| IaC (módulo) | `scripts/terraform/modules/dados/*.tf` | CREATE |
| IaC (local) | `scripts/terraform/local/*.tf` | CREATE |
| IaC (produção) | `scripts/terraform/production/*.tf` | CREATE |
| Nginx | `infra/nginx/*` → `scripts/nginx/*` | MOVE |
| IaC legado | `infra/aws/**`, `infra/local/**` | DELETE — depois do Terraform concluído e validado |
| Compose | `docker-compose.yml` | MODIFY — `aws-init` roda Terraform; `context: ./scripts/nginx` |
| Compose | `docker-compose.prod.yml` | MODIFY — `context: ./scripts/nginx` + comentários |
| Scripts npm | `package.json` | MODIFY — `infra:up`/`infra:down`/`infra:reset` direto no `docker compose`; `infra:owner` e `infra:validate` saem |
| Git | `.gitignore` | MODIFY — `.terraform/`, `*.tfstate*`, `*.tfvars` (exceto `*.example`) |
| Docs | `CLAUDE.md`, `README.md`, `deploy.md`, `docs/aws.md`, `docs/arquitetura.md` | MODIFY — paths, provisionamento via Terraform e scripts `infra:*` |
| Docs | `scripts/terraform/README.md` | CREATE |
| Workflow | `.claude/commands/{start-batch,done}.md` | MODIFY — tiram a checagem `npm run infra:owner` |

### Recursos

| Recurso | Terraform | Ambiente |
|---------|-----------|----------|
| Tabelas DynamoDB ×3 (TTL) | `aws_dynamodb_table` | local + production (PITR só em production) |
| Bucket S3 | `aws_s3_bucket` + `_cors_configuration` + `_lifecycle_configuration` | local + production |
| Endurecimento do bucket | `_public_access_block`, `_server_side_encryption_configuration`, `_versioning` | production |
| Fila SQS + DLQ | `aws_sqs_queue` ×2 + `redrive_policy` | local + production |
| IAM role da aplicação | `aws_iam_role` + `aws_iam_role_policy` | production |

- **CORS**: origem por variável (`cors_allowed_origins`) — `http://localhost:3000` no local, a
  origem pública em production.
- **IAM role**: menor privilégio sobre as 3 tabelas (`GetItem`/`PutItem`/`UpdateItem`/
  `DeleteItem`), o bucket (objetos + `ListBucket`) e a fila (`SendMessage` para a API;
  `ReceiveMessage`/`DeleteMessage` para o worker). ARNs vêm dos outputs do módulo `dados`.
- **Trust da role**: `ecs-tasks.amazonaws.com` — a aplicação roda em Fargate e assume a role
  como task role.
- **Guard de identidade**: `data.aws_caller_identity` + `check` recusando IAM user como
  operador do `apply` em production.

## Critérios de aceite

- [ ] `scripts/terraform/local` aplica limpo no Floci após `npm run infra:reset` (o `aws-init`
      termina com exit 0 e os outputs listam tabelas, bucket e filas)
- [ ] Segundo `terraform apply` em `local` reporta **zero mudanças** (idempotência real)
- [ ] `scripts/terraform/production`: `terraform validate` verde e `terraform plan` cobrindo
      tabelas, bucket, filas e a IAM role, com os mesmos nomes/atributos dos scripts atuais
- [ ] `infra/nginx` movido para `scripts/nginx`; `docker compose build nginx` verde nos dois
      compose
- [ ] Pasta `infra/` removida; nenhuma referência a `infra/` fora de `.claude/specs/` e
      `docs/security/` (histórico)
- [ ] Nenhuma referência a `infra:owner`/`infra:validate` em `CLAUDE.md` e `.claude/commands/`
- [ ] `package.json` sem nenhum script apontando para `infra/`; `CLAUDE.md`, `README.md`, `deploy.md` e `docs/aws.md`
      atualizados para os novos caminhos e para o fluxo Terraform
- [ ] Nenhum state, `.terraform/` ou `*.tfvars` com valor real versionado
- [ ] E2E local (Floci) passando: abertura → SQS → worker, e alteração
- [ ] Gates do escopo tocado verdes:
  - `scripts/terraform/**` → `terraform fmt -check -recursive` + `terraform validate` em
    `local` e `production`
  - `docker-compose*.yml` → `docker compose config -q` + `docker compose build nginx`
  - `make -C apps/backend test-integration` (a stack local mudou de provisionador)

## Notas

### Decisões tomadas

- **Execução local e manual** — o `terraform` é chamado da máquina do operador. Para
  production, as credenciais vêm de **IAM role assumida localmente**; o fluxo é validar
  (`plan`) e depois publicar a versão final no ambiente (`apply`).
- **State na pasta do ambiente** — backend `local`: `scripts/terraform/local/terraform.tfstate`
  e `scripts/terraform/production/terraform.tfstate`, ambos gitignorados. O state não carrega
  segredo: só nomes, ARNs, ID da conta e documentos de policy. Consequências aceitas: sem
  lock e sem histórico; o state de production existe só na máquina do operador, então perder
  o arquivo obriga a `terraform import` de cada recurso — vale backup manual fora do repo.
- **Ordem com a spec 037** — `depends_on: ["037"]`. A 038 só inicia com a 037 `done`.
- **Segredos por variável de ambiente** — `JWT_SECRET` e `SMTP_PASSWORD` chegam à aplicação
  pelo `.env` não versionado; o Terraform não toca neles.
- **IAM role, não IAM user** — a aplicação acessa a AWS por role; nenhuma access key
  estática é criada. A aplicação roda em Fargate, então a trust é `ecs-tasks.amazonaws.com`.
- **`infra/local` é apagado** — `stack-owner.sh`, `stack-down.sh`, `validate.sh` e `init.sh`
  saem junto com `infra/aws`, depois do Terraform concluído e validado. Os scripts `infra:*`
  do `package.json` passam a chamar o `docker compose` direto.
- **Terraform local em container** — o `aws-init` usa a imagem `hashicorp/terraform` (versão
  fixada) com `scripts/terraform` montado: `infra:up` segue sendo um comando só e não exige
  Terraform na máquina. O state cai em `scripts/terraform/local/`, e o `infra:reset` o apaga
  junto com o volume do Floci — senão ele aponta para recursos que não existem mais.


### Riscos

- **Compatibilidade do Floci com o provider AWS** — o provider faz chamadas de leitura que o
  `init.sh` nunca fez (ex.: `DescribeContinuousBackups`, `GetBucketTagging`,
  `ListTagsOfResource`). Validar cedo com um spike no módulo `dados`; se algum endpoint
  faltar, o recurso correspondente fica condicionado por variável no root `local`.
- **Um stack local por vez** — o gate de E2E/integração exige a stack Docker, exclusiva entre
  worktrees.
