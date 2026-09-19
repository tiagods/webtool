---
id: "021"
title: "Autenticação AWS em produção — IAM Roles + IaC (Fargate)"
status: in-progress   # draft | review | approved | in-progress | done | rejected
created: 2026-09-02
updated: 2026-09-18
author: "tiagods"
batch_size: "medium"   # grande — ver Notas (organizado em 4 fases, batch pode pausar entre elas)
depends_on: []         # 018/019 foram rejeitadas; o equivalente Go já existe (ver banner)
---

> **ATUALIZAÇÃO 2026-09-18 — pós-cutover Go (specs 022–029) e decisões do batch.**
>
> 1. **Backend é Go** (`apps/backend`, `cmd/api` + `cmd/worker`), não mais `apps/api` Node.
>    `apps/backend/infrastructure/config/config.go` é o único ponto que lê env e já implementa
>    o que as specs 018 (config centralizada) e 019 (`awsClientConfig`) previam — por isso
>    `depends_on` foi **limpo** (018/019 rejeitadas, equivalentes entregues pela migração Go).
>    `infrastructure/aws/config.go` monta os clients com `LoadDefaultConfig` e **só** injeta
>    credenciais estáticas quando `AWS_ENDPOINT_URL` existe (Floci); sem endpoint, cai na
>    cadeia padrão do SDK = **Task Role** — exatamente o alvo desta spec.
> 2. **O worker envia e-mail por SMTP** (`infrastructure/email`, `SMTP_*` no `config.go` e no
>    `docker-compose.prod.yml`). Não há uso de **SNS/SES** em lugar nenhum do backend Go.
>    Decisão do batch: **remover o SNS desta spec** (`provision-sns.sh`, a subscription SES e o
>    `sns:Publish` da worker role). SNS/SES vira spec futura só se a arquitetura voltar a usá-lo.
> 3. **`SMTP_PASSWORD` também é segredo** — decisão "tudo como env, nada chumbado": o worker
>    recebe `SMTP_PASSWORD` via **Secrets Manager** (`secrets[].valueFrom`), como o `JWT_SECRET`.
>    Nenhum valor secreto literal entra no repo/task definition.
> 4. **Nomes de env dos task definitions alinhados ao `config.go`** (`APP_ENV`, não `NODE_ENV`).
>    Nota: `config.Load` carrega o subconjunto SMTP **incondicionalmente**, então até a API
>    exige `SMTP_HOST/USER/FROM/TO` para subir — o `api.taskdef.json` inclui essas vars
>    (endereço de saída, sem `SMTP_PASSWORD`). Remover essa exigência da API é candidato a spec
>    futura de código (fora do escopo desta, que não toca `apps/*`).
> 5. **Verificação com shellcheck**: instalado nesta máquina (winget, 0.11.0); `sh -n` roda pelo
>    Git Bash. O `apply` real na conta AWS segue manual (sem credenciais de produção aqui).
> 6. **Somente IAM Roles — nunca IAM user.** Nenhum script cria `aws iam user` nem access key.
>    O runtime usa **Task Role**; o `apply` usa **role assumida** (SSO / `assume-role`), nunca
>    access keys de IAM user de longa duração. `common.sh` valida a identidade do caller via
>    `aws sts get-caller-identity` e **recusa** `:user/` por padrão (override consciente via
>    `PROLINK_ALLOW_IAM_USER=1`, só para break-glass documentado).

# Autenticação AWS em produção — IAM Roles + IaC (Fargate)

## Contexto

Hoje o único caminho de deploy documentado (`deploy.md`) é Docker Compose num host único
(Lightsail/EC2), e a autenticação AWS em produção depende de **variáveis de ambiente do host**
ou da IAM role da instância. A decisão de arquitetura mudou:

- **Produção roda em AWS Fargate** (ECS), não mais num host Compose único. `api` e `worker`
  (binários Go de `apps/backend`) sobem como tasks Fargate com acesso aos **mesmos recursos já
  usados pela arquitetura atual** (DynamoDB, S3, SQS).
- **`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` são exclusivas dos testes locais com o
  Floci.** Em produção **não existem credenciais estáticas** — cada task Fargate recebe uma
  **IAM Task Role** com permissões de menor privilégio, e o AWS SDK v2 (Go) resolve as
  credenciais automaticamente pelo endpoint de metadados do container
  (`AWS_CONTAINER_CREDENTIALS_*`) quando `AWS_ENDPOINT_URL` está ausente.
- As policies e roles precisam ser **IaC versionada no repositório**, não cliques no console.
  Hoje só existe provisionamento **local** (`infra/local/init.sh`, contra o Floci) e um único
  script de produção pontual (`infra/aws/set-cors-producao.sh`). Não há IaC que crie os
  recursos AWS reais nem as roles.

Specs relacionadas já `done`/rejeitadas: a **018** e a **019** foram rejeitadas no cutover Go —
o `apps/backend/infrastructure/config/config.go` centraliza a leitura de env e
`infrastructure/aws/config.go` já deixa o SDK resolver credenciais pela cadeia padrão. Esta spec
entrega a **camada de infraestrutura** que falta para essa transição funcionar.

## Objetivo

Entregar, como **IaC (scripts shell + AWS CLI, seguindo a convenção `infra/aws/`)**, tudo que
é necessário para `api` e `worker` rodarem em Fargate **sem nenhuma credencial AWS estática**,
com acesso de menor privilégio aos recursos da arquitetura atual. **Autenticação é sempre por
role — nenhum IAM user é criado ou usado**: Task Role no runtime e role assumida (SSO /
`assume-role`) no `apply`.

1. **IAM Roles + Policies** de menor privilégio (sem wildcards de recurso), por task:
   - `prolink-ecs-execution-role` — compartilhada (pull de imagem no ECR, logs no CloudWatch,
     leitura dos secrets injetados na task).
   - `prolink-api-task-role` — acesso runtime da API (DynamoDB, S3, SQS).
   - `prolink-worker-task-role` — acesso runtime do worker (DynamoDB, S3, SQS). Sem SNS.
2. **IaC dos recursos base** hoje só provisionados contra o Floci — DynamoDB (3 tabelas), S3
   (bucket + block public access + SSE + lifecycle + CORS), SQS (`prolink-abertura` +
   `prolink-abertura-dlq` + redrive).
3. **ECS Task Definitions** do Fargate para `api` e `worker`, referenciando as roles e
   injetando os segredos via **AWS Secrets Manager** (não env var em texto plano).
4. **`JWT_SECRET` e `SMTP_PASSWORD` em produção via Secrets Manager** — parar de passar por
   `environment:` no Compose / task definition.
5. **Docs e limpeza**: `docs/aws.md`, `deploy.md`, `docker-compose.prod.yml` (remover
   `JWT_SECRET`/`SMTP_PASSWORD` em claro; confirmar ausência de qualquer credencial AWS), README.

## Fora de escopo

- **Criar cluster ECS, services, ALB/Target Groups, Security Groups, subnets/VPC, Route53,
  ACM.** Esta spec registra *task definitions* e roles; subir os *services* Fargate e a rede
  é uma spec própria (021b / infra de rede).
- **Terraform / CloudFormation / CDK.** Decisão: manter a convenção do repo — shell + AWS CLI
  idempotente (`create-or-update`). Ver Notas para o trade-off.
- **Código de aplicação.** `apps/backend` já fica pronto pela migração Go. Nenhum arquivo de
  `apps/*` muda (a exigência de `SMTP_*` na API fica como dívida registrada — ver banner).
- **SNS/SES.** O worker usa SMTP; não há tópico SNS a provisionar.
- **Pipeline de build/push para o ECR** — a imagem é produzida pelo `Dockerfile` de
  `apps/backend` (`APP=api` / `APP=worker`); publicá-la é spec futura.
- **Verificação com AWS real.** Este ambiente não tem credenciais de produção. A verificação
  automatizada cobre lint/shellcheck/validação estrutural + um checklist de revisão; o
  `apply` contra a conta AWS real é um passo manual documentado, executado pelo usuário.
- **Rotação automática dos segredos** (só migrar para Secrets Manager; rotação é spec futura).

## Design

### Convenção e layout

```
infra/aws/
  lib/
    common.sh                 # helpers: resolve account-id, região, "create-or-update",
                              # require-cmd, valida que o caller é role (recusa IAM user)
    params.sh                 # nomes/ARNs canônicos dos recursos (fonte única — ver "Anti-drift")
  provision-dynamodb.sh       # 3 tabelas + TTL + PITR
  provision-s3.sh             # bucket + block public + SSE + lifecycle + CORS (absorve set-cors-producao.sh)
  provision-sqs.sh            # fila + DLQ + redrive policy
  provision-iam.sh            # execution role + api task role + worker task role (+ policies)
  provision-secrets.sh        # cria/atualiza os secrets JWT_SECRET e SMTP_PASSWORD
  register-task-defs.sh       # aws ecs register-task-definition (api, worker)
  provision-all.sh            # roda todos na ordem correta (idempotente)
  iam/
    ecs-execution-role.trust.json
    ecs-execution-role.policy.json
    api-task-role.trust.json
    api-task-role.policy.json
    worker-task-role.trust.json
    worker-task-role.policy.json
  ecs/
    api.taskdef.json          # template com ${PLACEHOLDERS} resolvidos pelo script
    worker.taskdef.json
```

- Todos os scripts: `set -eu`, `#!/usr/bin/env sh`, sem Bashisms (consistente com
  `init.sh` / `set-cors-producao.sh`), parametrizados por env (`AWS_REGION`, `AWS_ACCOUNT_ID`
  auto-resolvido via `aws sts get-caller-identity`, `PROD_ORIGIN`, `SMTP_TO`).
- **Idempotência**: cada script tenta `describe`/`get` e decide entre `create-*` e
  `update-*`/`put-*`. Rodar duas vezes não quebra nem duplica.
- **Sem `AWS_ENDPOINT_URL`** nesses scripts — são produção real. O operador roda a partir de
  uma máquina autenticada por **role assumida** (SSO / `assume-role`), **nunca** com access keys
  de IAM user; `common.sh` valida `aws sts get-caller-identity` e recusa identidades `:user/`
  (override consciente `PROLINK_ALLOW_IAM_USER=1`). Roda-se **uma vez** (ou quando algo muda).

### Anti-drift local × produção

`infra/local/init.sh` (Floci) e os novos `infra/aws/provision-*.sh` descrevem os **mesmos
recursos** (schema das tabelas, config da fila, regras de lifecycle). Para não divergirem:

- `infra/aws/lib/params.sh` vira a **fonte única** dos nomes/parâmetros e é `source`-ado pelos
  scripts de produção.
- `init.sh` é ajustado para também `source` esse `params.sh` (com override de endpoint/região
  para o Floci) — os valores estruturais (TTL attr, `VisibilityTimeout`, `maxReceiveCount`,
  regras de lifecycle) passam a vir de um lugar só.
- CA explícito cobre "local e prod leem os mesmos parâmetros estruturais".

### IAM — menor privilégio (sem wildcard de recurso)

Todas as policies usam ARNs explícitos montados de `params.sh` (conta + região
parametrizadas). **Nenhum `Resource: "*"`** exceto onde a própria AWS exige (nenhum caso
identificado aqui). O conjunto de ações abaixo foi levantado do código Go
(`apps/backend/infrastructure/aws/{dynamodb,s3,sqs}.go`, `worker_controller.go`) e é conferido
1:1 na Fase 2.

**`prolink-ecs-execution-role`** (assumida pelo agente ECS, não pela aplicação)
- Trust: `ecs-tasks.amazonaws.com`.
- `AmazonECSTaskExecutionRolePolicy` (managed) — pull ECR + `logs:CreateLogStream` /
  `logs:PutLogEvents`.
- Inline: `secretsmanager:GetSecretValue` **apenas** nos ARNs dos secrets `prolink/jwt-secret`
  e `prolink/smtp-password`.

**`prolink-api-task-role`** (assumida pela task da API)
| Serviço | Ações | Recurso |
|---|---|---|
| DynamoDB | `GetItem`, `PutItem`, `UpdateItem`, `DeleteItem` | `table/fichas-abertura`, `table/fichas-alteracao`, `table/prolink-aceites-lgpd` |
| S3 | `GetObject`, `PutObject`, `DeleteObject`, `PutObjectTagging` | `arn:aws:s3:::prolink-fichas/*` |
| S3 | `ListBucket` | `arn:aws:s3:::prolink-fichas` (necessário p/ `DeletePrefix` → `ListObjectsV2`) |
| SQS | `SendMessage` | `queue/prolink-abertura` |

> Justificativa por ação: `DeleteItem` — `deleteDraft` (LGPD Art. 18, Spec 011).
> `PutObjectTagging` — a presigned URL de upload assina `x-amz-tagging=retention=rascunho`
> (`s3.go:44-49`) e o `Copy` usa `TaggingDirective=REPLACE` (`s3.go:93-99`). `CopyObject` não
> é ação IAM própria: exige `GetObject` na origem + `PutObject` no destino (ambos cobertos
> pelo `/*`). **Nada de `Query`/`Scan`** — o código só acessa por chave.

**`prolink-worker-task-role`** (assumida pela task do worker)
| Serviço | Ações | Recurso |
|---|---|---|
| DynamoDB | `GetItem`, `UpdateItem` | `table/fichas-abertura`, `table/fichas-alteracao` |
| S3 | `GetObject` | `arn:aws:s3:::prolink-fichas/*` |
| SQS | `ReceiveMessage`, `DeleteMessage` | `queue/prolink-abertura` |

> Conferido 1:1 na Fase 2: o worker só **assina** URLs de download
> (`NotificarSubmissao.gerarLinks` → `PresignedDownloadURL`), por isso leva apenas
> `s3:GetObject` — sem `PutObject`/`DeleteObject`/`PutObjectTagging`/`ListBucket`. No DynamoDB
> lê o rascunho (`GetItem`) e zera os dados sensíveis (`MarcarEnviado` → `UpdateItem`); cobre as
> duas tabelas porque o worker trata `abertura` e `alteracao` (hoje `StartWorker` monta só o repo
> da tabela de abertura — corrigir o wiring de alteração é dívida de código fora desta spec).
> Não precisa de acesso à DLQ (o redrive é feito pelo próprio SQS). Sem SNS (email via SMTP).

### Recursos base — paridade com o que já existe

| Recurso | Config (de `params.sh`) | Notas |
|---|---|---|
| DynamoDB `fichas-abertura` / `fichas-alteracao` | PK `sessionId` (S), `PAY_PER_REQUEST`, TTL attr `ttl`, **PITR on** | mesmo schema do `init.sh` |
| DynamoDB `prolink-aceites-lgpd` | PK `sessionId` (S) + SK `versaoTermo` (S), `PAY_PER_REQUEST`, TTL `ttl`, PITR on | |
| S3 `prolink-fichas` | Block Public Access (todos os 4), SSE-S3, **Versioning on**, Lifecycle `delete-rascunhos-abandonados` (expira objetos com tag `retention=rascunho` após 30d), CORS `PUT`/`HEAD` restrito a `PROD_ORIGIN` | CORS absorve `set-cors-producao.sh` (script antigo passa a delegar ou é removido) |
| SQS `prolink-abertura` | `VisibilityTimeout=120`, `MessageRetentionPeriod=86400`, redrive → DLQ `maxReceiveCount=5` | |
| SQS `prolink-abertura-dlq` | `MessageRetentionPeriod=1209600` (14d) | |

> Se algum desses recursos **já existe** na conta (criado manualmente), o script idempotente
> só aplica as diferenças (ex.: liga PITR, ajusta lifecycle). Documentar no cabeçalho de cada
> script o que ele altera em recurso preexistente.

### ECS Task Definitions (Fargate)

`register-task-defs.sh` resolve os placeholders de `ecs/*.taskdef.json` e roda
`aws ecs register-task-definition`. **Não** cria service nem cluster. As env vars espelham o
que `apps/backend/infrastructure/config/config.go` lê.

`api.taskdef.json` (essência):
```jsonc
{
  "family": "prolink-api",
  "requiresCompatibilities": ["FARGATE"],
  "networkMode": "awsvpc",
  "cpu": "256", "memory": "512",
  "executionRoleArn": "${ECS_EXECUTION_ROLE_ARN}",
  "taskRoleArn": "${API_TASK_ROLE_ARN}",
  "containerDefinitions": [{
    "name": "api",
    "image": "${API_IMAGE_URI}",          // ECR, tag resolvida no deploy
    "portMappings": [{ "containerPort": 3001 }],
    "environment": [
      { "name": "APP_ENV", "value": "prod" },
      { "name": "AWS_REGION", "value": "${AWS_REGION}" },
      { "name": "AWS_DYNAMODB_TABLE", "value": "fichas-abertura" },
      { "name": "AWS_DYNAMODB_ALTERACAO_TABLE", "value": "fichas-alteracao" },
      { "name": "AWS_DYNAMODB_ACEITES_TABLE", "value": "prolink-aceites-lgpd" },
      { "name": "AWS_S3_BUCKET", "value": "prolink-fichas" },
      { "name": "AWS_SQS_QUEUE_URL", "value": "${SQS_QUEUE_URL}" },
      { "name": "SESSION_EXPIRY_SECONDS", "value": "7200" },
      // config.Load exige SMTP mesmo na API (dívida registrada no banner) — endereço de saída
      { "name": "SMTP_HOST", "value": "${SMTP_HOST}" },
      { "name": "SMTP_PORT", "value": "587" },
      { "name": "SMTP_USER", "value": "${SMTP_USER}" },
      { "name": "SMTP_FROM", "value": "${SMTP_FROM}" },
      { "name": "SMTP_TO", "value": "${SMTP_TO}" }
      // SEM AWS_ENDPOINT_URL, SEM AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
    ],
    "secrets": [
      { "name": "JWT_SECRET", "valueFrom": "${JWT_SECRET_ARN}" }
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/prolink-api",
        "awslogs-region": "${AWS_REGION}",
        "awslogs-stream-prefix": "api"
      }
    }
  }]
}
```

`worker.taskdef.json` — análogo, **sem `portMappings`**, `taskRoleArn = ${WORKER_TASK_ROLE_ARN}`,
`image = ${WORKER_IMAGE_URI}` (build `APP=worker` de `apps/backend/Dockerfile`), mesmas env AWS
+ `SMTP_*`, e **dois secrets**: `JWT_SECRET` e `SMTP_PASSWORD` (`valueFrom`). Log group
`/ecs/prolink-worker`.

> Os log groups (`/ecs/prolink-api`, `/ecs/prolink-worker`) são criados por
> `provision-iam.sh` ou um `provision-logs.sh` dedicado (retention 30d) — a execution role
> tem permissão de escrever, mas o grupo precisa existir.

### Segredos via Secrets Manager (`JWT_SECRET` e `SMTP_PASSWORD`)

- `provision-secrets.sh` cria/atualiza `prolink/jwt-secret` e `prolink/smtp-password`
  (`aws secretsmanager create-secret` ou `put-secret-value`). Os valores **não** entram no
  repo — o script lê de `JWT_SECRET`/`SMTP_PASSWORD` do ambiente do operador ou gera o
  `JWT_SECRET` com `openssl rand -base64 32` na primeira vez e imprime uma única vez.
- `web` também usa `JWT_SECRET` (valida o cookie em `middleware.ts`). Quando o `web` for para
  Fargate, sua task definition (spec de rede/021b) injeta o **mesmo** secret. Enquanto o `web`
  seguir noutro runtime, documentar que o valor tem que bater.
- `docker-compose.prod.yml`: remover `JWT_SECRET: ${JWT_SECRET}` e `SMTP_PASSWORD: ${SMTP_PASSWORD}`
  em claro dos serviços — no path Compose (se mantido para outro ambiente) passam a vir de um
  `.env` não-versionado; no path Fargate vêm do Secrets Manager.

### Camadas afetadas

| Camada | Arquivo | Ação |
|--------|---------|------|
| IaC | `infra/aws/lib/common.sh`, `infra/aws/lib/params.sh` | CREATE |
| IaC | `infra/aws/provision-{dynamodb,s3,sqs,iam,secrets}.sh` | CREATE |
| IaC | `infra/aws/register-task-defs.sh`, `infra/aws/provision-all.sh` | CREATE |
| IaC | `infra/aws/iam/*.json` (6 arquivos), `infra/aws/ecs/*.taskdef.json` (2) | CREATE |
| IaC | `infra/aws/set-cors-producao.sh` | EDIT (delega a `provision-s3.sh`) ou DELETE |
| IaC | `infra/local/init.sh` | EDIT (source de `params.sh` p/ parâmetros estruturais) |
| Infra | `docker-compose.prod.yml` | EDIT (remove `JWT_SECRET`/`SMTP_PASSWORD` em claro; comentário sobre credenciais AWS) |
| Docs | `docs/aws.md` | EDIT (seções IAM Task Role: sair de "a detalhar" p/ ARNs/ações reais; apontar IaC) |
| Docs | `deploy.md` | EDIT (novo caminho: build → push ECR → `register-task-defs.sh` → deploy service) |
| Docs | `README.md` | EDIT (env vars: marcar `AWS_ACCESS_KEY_ID`/`_SECRET`/`AWS_ENDPOINT_URL` como **dev/Floci apenas**; `JWT_SECRET`/`SMTP_PASSWORD` prod via Secrets Manager) |

## Critérios de aceite

- [ ] **CA1 — IAM roles**: `infra/aws/provision-iam.sh` cria/atualiza (idempotente)
  `prolink-ecs-execution-role`, `prolink-api-task-role`, `prolink-worker-task-role` com trust
  policies para `ecs-tasks.amazonaws.com`.
- [ ] **CA2 — Menor privilégio**: nenhuma policy tem `Resource: "*"`; toda ação é escopada aos
  ARNs exatos de `params.sh` (verificável por `grep`/`jq` nos `iam/*.json`). O conjunto de
  ações bate 1:1 com o que `apps/backend/infrastructure/aws/*` e
  `apps/backend/infrastructure/worker_controller.go` realmente chamam — sem `Query`/`Scan`,
  sem `s3:*`, sem SNS.
- [ ] **CA3 — Recursos base IaC**: `provision-{dynamodb,s3,sqs}.sh` provisionam os recursos com
  a mesma config estrutural hoje aplicada pelo `init.sh` ao Floci (3 tabelas + TTL, bucket +
  block public + lifecycle + CORS, fila + DLQ + redrive). Rodar cada script 2× não altera o
  resultado nem erra.
- [ ] **CA4 — Anti-drift**: `infra/aws/lib/params.sh` é a fonte única dos nomes/parâmetros
  estruturais e é consumida tanto pelos scripts de produção quanto pelo `infra/local/init.sh`.
- [ ] **CA5 — Task definitions**: `register-task-defs.sh` registra `prolink-api` e
  `prolink-worker` via `aws ecs register-task-definition`, com `taskRoleArn`/`executionRoleArn`
  corretos, **sem** `AWS_ENDPOINT_URL` e **sem** `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`
  no bloco `environment`, e `JWT_SECRET`/`SMTP_PASSWORD` só via `secrets[].valueFrom`.
- [ ] **CA6 — Secrets Manager**: `provision-secrets.sh` cria/atualiza `prolink/jwt-secret` e
  `prolink/smtp-password` sem gravar os valores no repositório; a execution role tem
  `secretsmanager:GetSecretValue` restrito a esses dois ARNs.
- [ ] **CA7 — Compose limpo**: `docker-compose.prod.yml` não tem `JWT_SECRET`/`SMTP_PASSWORD`
  em texto plano nem qualquer variável de credencial AWS; comentário explica de onde vêm em
  cada runtime.
- [ ] **CA8 — Sem regressão de código**: `npm run build` e `npm run lint` passam; nenhum
  arquivo de `apps/*` muda o comportamento (a 021 é infra + docs).
- [ ] **CA9 — Docs**: `docs/aws.md` (seções "IAM Task Role") deixam de dizer "a detalhar" e
  listam ações/ARNs reais apontando para `infra/aws/`; `deploy.md` descreve o fluxo Fargate
  (ECR + task def + role) e remove a orientação de credenciais via env do host; `README.md`
  marca as env vars AWS estáticas como dev-only.
- [ ] **CA10 — Verificação**: todos os `infra/aws/*.sh` passam `sh -n` (Git Bash) e `shellcheck`
  (0.11.0, instalado) sem erros; todos os `iam/*.json` e `ecs/*.taskdef.json` são JSON válido
  (`jq`) e validam contra o formato esperado. O `apply` real na conta AWS é passo manual
  documentado em `deploy.md`, executado pelo usuário.
- [ ] **CA11 — Sem IAM user**: nenhum script cria `aws iam user`, access key ou `iam:CreateUser`;
  `common.sh` recusa identidade `:user/` (override consciente `PROLINK_ALLOW_IAM_USER=1`), de
  modo que tanto o runtime (Task Role) quanto o `apply` (SSO/`assume-role`) usem **sempre role**.

## Notas

- **Tamanho**: apesar de `medium` no frontmatter, é uma spec grande. `todo.md` deve ser
  organizado em 4 fases, com o batch podendo pausar entre elas:
  1. `lib/` + `params.sh` + recursos base (`dynamodb`, `s3`, `sqs`) + anti-drift no `init.sh`.
  2. IAM (roles, policies, trust) + log groups.
  3. Secrets Manager + task definitions + `register-task-defs.sh` + `provision-all.sh`.
  4. `docker-compose.prod.yml` + docs (`aws.md`, `deploy.md`, `README.md`) + verificação.
  Se ficar grande demais, dividir em **021a** (fases 1–2) e **021b** (fases 3–4).
- **Shell + CLI vs. CloudFormation/Terraform** (decisão do usuário): mantém a convenção do
  repo (`infra/local/init.sh`, `infra/aws/set-cors-producao.sh`), zero toolchain nova, zero
  state file para gerir. Trade-off aceito: sem *drift detection* nem *rollback* automáticos —
  mitigado por idempotência (`create-or-update`), `params.sh` como fonte única, e o conjunto
  pequeno e estável de recursos. Se a infra AWS crescer (múltiplos ambientes, VPC, ALB),
  reavaliar CloudFormation numa spec futura.
- **Pós-cutover Go (substitui a relação com a 019)**: `infrastructure/aws/config.go` usa
  `awsconfig.LoadDefaultConfig` com apenas `WithRegion`; credenciais estáticas só entram quando
  `UsesCustomEndpoint()` (Floci). Em produção, o SDK v2 resolve a **Task Role** pelo metadata
  do container. Nenhum código novo é necessário — a 018/019 foram rejeitadas e o `depends_on`
  foi limpo.
- **Relação com a Spec 013**: o worker **já existe** (`cmd/worker` + serviço `worker` no
  `docker-compose.prod.yml`), envia e-mail via SMTP. Esta spec **define** a
  `prolink-worker-task-role` e a `worker.taskdef.json` (menor privilégio já desenhado); publicar
  a imagem no ECR e subir o *service* Fargate é da spec de rede/021b.
- **Fora desta spec, mas no radar** (candidatos a 021b / spec de rede):
  - Cluster ECS, services (`api`, `worker`, futuramente `web`), ALB + TLS (ACM), Security
    Groups, subnets privadas + NAT/VPC endpoints (DynamoDB/S3 gateway endpoints reduzem custo
    e superfície).
  - Task definition do `web` em Fargate (hoje o `web` não tem acesso AWS — só precisa de
    `JWT_SECRET` para o `middleware.ts`).
  - Pipeline de build/push para o ECR (hoje `docker compose build` local).
  - Alarmes CloudWatch (profundidade da fila, DLQ > 0, erros 5xx da API).
- **Dívida registrada**: `config.Load` exige `SMTP_*` mesmo para a API (que não envia e-mail).
  O taskdef da API inclui essas vars; tornar o subconjunto SMTP opcional por processo é
  candidato a spec de código futura.
- **`AWS_ACCOUNT_ID`**: nunca chumbado nos JSON — resolvido em runtime por
  `aws sts get-caller-identity --query Account` no `common.sh` e injetado nos placeholders.
