---
id: "021"
title: "Autenticação AWS em produção — IAM Roles + IaC (Fargate)"
status: draft          # draft | review | approved | in-progress | done | rejected
created: 2026-09-02
author: "tiagods"
batch_size: "medium"   # grande — ver Notas (organizado em 4 fases, batch pode pausar entre elas)
depends_on: ["018", "019"]
---

# Autenticação AWS em produção — IAM Roles + IaC (Fargate)

## Contexto

Hoje o único caminho de deploy documentado (`deploy.md`) é Docker Compose num host único
(Lightsail/EC2), e a autenticação AWS em produção depende de **variáveis de ambiente do host**
ou da IAM role da instância. A decisão de arquitetura mudou:

- **Produção roda em AWS Fargate** (ECS), não mais num host Compose único. `apps/api` e
  `apps/worker` sobem como tasks Fargate com acesso aos **mesmos recursos já usados pela
  arquitetura atual** (DynamoDB, S3, SQS, SNS).
- **`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` são exclusivas dos testes locais com o
  Floci.** Em produção **não existem credenciais estáticas** — cada task Fargate recebe uma
  **IAM Task Role** com permissões de menor privilégio, e o AWS SDK v3 resolve as credenciais
  automaticamente pelo endpoint de metadados do container (`AWS_CONTAINER_CREDENTIALS_*`).
- As policies e roles precisam ser **IaC versionada no repositório**, não cliques no console.
  Hoje só existe provisionamento **local** (`infra/local/init.sh`, contra o Floci) e um único
  script de produção pontual (`infra/aws/set-cors-producao.sh`). Não há IaC que crie os
  recursos AWS reais nem as roles.

Specs relacionadas já aprovadas/planejadas cobrem a **camada de código**:
- **Spec 018** centraliza a leitura de `process.env` num `config.ts` por app.
- **Spec 019** cria `apps/api/lib/aws/config.ts` com `awsClientConfig()`, que **já** retorna
  apenas `{ region }` quando `AWS_ENDPOINT_URL` está ausente — deixando o SDK resolver
  credenciais pela cadeia padrão (Task Role). Esta spec é a "spec futura" citada no
  *Fora de escopo* da 019.

Esta spec entrega a **camada de infraestrutura** que falta para essa transição funcionar.

## Objetivo

Entregar, como **IaC (scripts shell + AWS CLI, seguindo a convenção `infra/aws/`)**, tudo que
é necessário para `apps/api` e `apps/worker` rodarem em Fargate **sem nenhuma credencial AWS
estática**, com acesso de menor privilégio aos recursos da arquitetura atual:

1. **IAM Roles + Policies** de menor privilégio (sem wildcards de recurso), por task:
   - `prolink-ecs-execution-role` — compartilhada (pull de imagem no ECR, logs no CloudWatch,
     leitura dos secrets injetados na task).
   - `prolink-api-task-role` — acesso runtime da API (DynamoDB, S3, SQS).
   - `prolink-worker-task-role` — acesso runtime do worker (DynamoDB, S3, SQS, SNS).
2. **IaC dos recursos base** hoje só provisionados contra o Floci — DynamoDB (3 tabelas), S3
   (bucket + block public access + SSE + lifecycle + CORS), SQS (`prolink-abertura` +
   `prolink-abertura-dlq` + redrive), SNS (`prolink-abertura-emails` + subscription SES).
3. **ECS Task Definitions** do Fargate para `api` e `worker`, referenciando as roles e
   injetando `JWT_SECRET` via **AWS Secrets Manager** (não env var em texto plano).
4. **`JWT_SECRET` em produção via Secrets Manager** — parar de passar por `environment:` no
   Compose / task definition.
5. **Docs e limpeza**: `docs/aws.md`, `deploy.md`, `docker-compose.prod.yml` (remover
   `JWT_SECRET` em claro; confirmar ausência de qualquer credencial AWS), README.

## Fora de escopo

- **Criar cluster ECS, services, ALB/Target Groups, Security Groups, subnets/VPC, Route53,
  ACM.** Esta spec registra *task definitions* e roles; subir os *services* Fargate e a rede
  é uma spec própria (021b / infra de rede).
- **Terraform / CloudFormation / CDK.** Decisão: manter a convenção do repo — shell + AWS CLI
  idempotente (`create-or-update`). Ver Notas para o trade-off.
- **Código de aplicação.** `apps/api` já fica pronto pela 018 + 019. O `apps/worker` (que
  ainda não existe) traz seu próprio `aws.ts` na Spec 013 — esta spec só **define** a role e a
  task definition do worker; a imagem e o deploy do serviço worker são da 013.
- **Verificação com AWS real.** Este ambiente não tem credenciais de produção. A verificação
  automatizada cobre lint/shellcheck/validação estrutural + um checklist de revisão; o
  `apply` contra a conta AWS real é um passo manual documentado, executado pelo usuário.
- **Rotação automática do `JWT_SECRET`** (só migrar para Secrets Manager; rotação é spec
  futura).
- **Verificação de identidade SES** (`contato@prolinkcontabil.com.br`) — é ação manual via
  DNS/console, apenas documentada.
- **Migração do worker para Lambda** (segue fora de escopo, como na 013).

## Design

### Convenção e layout

```
infra/aws/
  lib/
    common.sh                 # helpers: resolve account-id, região, "create-or-update", require-cmd
    params.sh                 # nomes/ARNs canônicos dos recursos (fonte única — ver "Anti-drift")
  provision-dynamodb.sh       # 3 tabelas + TTL + PITR
  provision-s3.sh             # bucket + block public + SSE + lifecycle + CORS (absorve set-cors-producao.sh)
  provision-sqs.sh            # fila + DLQ + redrive policy
  provision-sns.sh            # tópico + subscription SES
  provision-iam.sh            # execution role + api task role + worker task role (+ policies)
  provision-secrets.sh        # cria/atualiza o secret JWT_SECRET no Secrets Manager
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
  auto-resolvido via `aws sts get-caller-identity`, `PROD_ORIGIN`, `SES_NOTIFY_EMAIL`).
- **Idempotência**: cada script tenta `describe`/`get` e decide entre `create-*` e
  `update-*`/`put-*`. Rodar duas vezes não quebra nem duplica.
- **Sem `AWS_ENDPOINT_URL`** nesses scripts — são produção real. O operador roda a partir de
  uma máquina com credenciais de admin (SSO/perfil), **uma vez** (ou quando algo muda).

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
identificado aqui).

**`prolink-ecs-execution-role`** (assumida pelo agente ECS, não pela aplicação)
- Trust: `ecs-tasks.amazonaws.com`.
- `AmazonECSTaskExecutionRolePolicy` (managed) — pull ECR + `logs:CreateLogStream` /
  `logs:PutLogEvents`.
- Inline: `secretsmanager:GetSecretValue` **apenas** no ARN do secret `prolink/jwt-secret`.

**`prolink-api-task-role`** (assumida pela task da API)
| Serviço | Ações | Recurso |
|---|---|---|
| DynamoDB | `GetItem`, `PutItem`, `UpdateItem`, `DeleteItem` | `table/fichas-abertura`, `table/fichas-alteracao`, `table/prolink-aceites-lgpd` |
| S3 | `GetObject`, `PutObject`, `DeleteObject`, `PutObjectTagging` | `arn:aws:s3:::prolink-fichas/*` |
| S3 | `ListBucket` | `arn:aws:s3:::prolink-fichas` (necessário p/ `deleteObjectsWithPrefix` → `ListObjectsV2`) |
| SQS | `SendMessage` | `queue/prolink-abertura` |

> Justificativa por ação: `DeleteItem` — `deleteDraft` (LGPD Art. 18, Spec 011).
> `PutObjectTagging` — tag `retention=rascunho` na presigned URL e no `CopyObject`.
> `CopyObject` não é ação IAM própria: exige `GetObject` na origem + `PutObject` no destino
> (ambos cobertos pelo `/*`). **Nada de `Query`/`Scan`** — o código só acessa por chave.

**`prolink-worker-task-role`** (assumida pela task do worker — Spec 013)
| Serviço | Ações | Recurso |
|---|---|---|
| DynamoDB | `GetItem`, `UpdateItem` | `table/fichas-abertura` (+ `table/fichas-alteracao` quando o worker tratar alteração) |
| S3 | `GetObject`, `PutObject`, `DeleteObject` | `arn:aws:s3:::prolink-fichas/*` |
| S3 | `ListBucket` | `arn:aws:s3:::prolink-fichas` |
| SNS | `Publish` | `topic/prolink-abertura-emails` |
| SQS | `ReceiveMessage`, `DeleteMessage`, `GetQueueAttributes` | `queue/prolink-abertura` |

> O worker **não** precisa de acesso à DLQ (o redrive é feito pelo próprio SQS). Reprocessar a
> DLQ manualmente é feito pelo operador, não pela task role.

### Recursos base — paridade com o que já existe

| Recurso | Config (de `params.sh`) | Notas |
|---|---|---|
| DynamoDB `fichas-abertura` / `fichas-alteracao` | PK `sessionId` (S), `PAY_PER_REQUEST`, TTL attr `ttl`, **PITR on** | mesmo schema do `init.sh` |
| DynamoDB `prolink-aceites-lgpd` | PK `sessionId` (S) + SK `versaoTermo` (S), `PAY_PER_REQUEST`, TTL `ttl`, PITR on | |
| S3 `prolink-fichas` | Block Public Access (todos os 4), SSE-S3, **Versioning on**, Lifecycle `delete-rascunhos-abandonados` (expira objetos com tag `retention=rascunho` após 30d), CORS `PUT`/`HEAD` restrito a `PROD_ORIGIN` | CORS absorve `set-cors-producao.sh` (script antigo passa a delegar ou é removido) |
| SQS `prolink-abertura` | `VisibilityTimeout=120`, `MessageRetentionPeriod=86400`, redrive → DLQ `maxReceiveCount=5` | |
| SQS `prolink-abertura-dlq` | `MessageRetentionPeriod=1209600` (14d) | |
| SNS `prolink-abertura-emails` | Standard; subscription `email` → `SES_NOTIFY_EMAIL` | confirmação do e-mail é manual |

> Se algum desses recursos **já existe** na conta (criado manualmente), o script idempotente
> só aplica as diferenças (ex.: liga PITR, ajusta lifecycle). Documentar no cabeçalho de cada
> script o que ele altera em recurso preexistente.

### ECS Task Definitions (Fargate)

`register-task-defs.sh` resolve os placeholders de `ecs/*.taskdef.json` e roda
`aws ecs register-task-definition`. **Não** cria service nem cluster.

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
      { "name": "NODE_ENV", "value": "production" },
      { "name": "AWS_REGION", "value": "${AWS_REGION}" },
      { "name": "AWS_DYNAMODB_TABLE", "value": "fichas-abertura" },
      { "name": "AWS_DYNAMODB_ALTERACAO_TABLE", "value": "fichas-alteracao" },
      { "name": "AWS_DYNAMODB_ACEITES_TABLE", "value": "prolink-aceites-lgpd" },
      { "name": "AWS_S3_BUCKET", "value": "prolink-fichas" },
      { "name": "AWS_SQS_QUEUE_URL", "value": "${SQS_QUEUE_URL}" },
      { "name": "SESSION_EXPIRY_SECONDS", "value": "7200" }
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

`worker.taskdef.json` — análogo, sem `portMappings`, com `AWS_SNS_TOPIC_ARN`,
`taskRoleArn = ${WORKER_TASK_ROLE_ARN}`, `image = ${WORKER_IMAGE_URI}` (produzida pela
Spec 013). Log group `/ecs/prolink-worker`.

> Os log groups (`/ecs/prolink-api`, `/ecs/prolink-worker`) são criados por
> `provision-iam.sh` ou um `provision-logs.sh` dedicado (retention 30d) — a execution role
> tem permissão de escrever, mas o grupo precisa existir.

### `JWT_SECRET` via Secrets Manager

- `provision-secrets.sh` cria `prolink/jwt-secret` (`aws secretsmanager create-secret` ou
  `put-secret-value`). O valor **não** entra no repo — o script lê de `JWT_SECRET` do
  ambiente do operador ou gera com `openssl rand -base64 32` na primeira vez e imprime uma
  única vez.
- `web` também usa `JWT_SECRET` (valida o cookie em `middleware.ts`). Quando o `web` for para
  Fargate, sua task definition (spec de rede/021b) injeta o **mesmo** secret. Enquanto o `web`
  seguir noutro runtime, documentar que o valor tem que bater.
- `docker-compose.prod.yml`: remover `JWT_SECRET: ${JWT_SECRET}` dos serviços — no path
  Compose (se mantido para outro ambiente) ele passa a vir de um `.env` não-versionado; no
  path Fargate vem do Secrets Manager.

### Camadas afetadas

| Camada | Arquivo | Ação |
|--------|---------|------|
| IaC | `infra/aws/lib/common.sh`, `infra/aws/lib/params.sh` | CREATE |
| IaC | `infra/aws/provision-{dynamodb,s3,sqs,sns,iam,secrets}.sh` | CREATE |
| IaC | `infra/aws/register-task-defs.sh`, `infra/aws/provision-all.sh` | CREATE |
| IaC | `infra/aws/iam/*.json` (6 arquivos), `infra/aws/ecs/*.taskdef.json` (2) | CREATE |
| IaC | `infra/aws/set-cors-producao.sh` | EDIT (delega a `provision-s3.sh`) ou DELETE |
| IaC | `infra/local/init.sh` | EDIT (source de `params.sh` p/ parâmetros estruturais) |
| Infra | `docker-compose.prod.yml` | EDIT (remove `JWT_SECRET` em claro; comentário sobre credenciais AWS) |
| Docs | `docs/aws.md` | EDIT (seções IAM Task Role: sair de "a detalhar" p/ ARNs/ações reais; apontar IaC) |
| Docs | `deploy.md` | EDIT (novo caminho: build → push ECR → `register-task-defs.sh` → deploy service; Passo 1 item 4 reescrito) |
| Docs | `README.md` | EDIT (env vars: marcar `AWS_ACCESS_KEY_ID`/`_SECRET`/`AWS_ENDPOINT_URL` como **dev/Floci apenas**; `JWT_SECRET` prod via Secrets Manager) |
| Specs | `013-worker-pdf-email.md` | EDIT (nota: role + taskdef do worker vêm da 021; `aws.ts` do worker espelha `awsClientConfig()` da 019) |

## Critérios de aceite

- [ ] **CA1 — IAM roles**: `infra/aws/provision-iam.sh` cria/atualiza (idempotente)
  `prolink-ecs-execution-role`, `prolink-api-task-role`, `prolink-worker-task-role` com trust
  policies para `ecs-tasks.amazonaws.com`.
- [ ] **CA2 — Menor privilégio**: nenhuma policy tem `Resource: "*"`; toda ação é escopada aos
  ARNs exatos de `params.sh` (verificável por `grep`/`jq` nos `iam/*.json`). O conjunto de
  ações bate 1:1 com o que `apps/api/lib/aws/*` (e o worker planejado na 013) realmente chama
  — sem `Query`/`Scan`, sem `s3:*`.
- [ ] **CA3 — Recursos base IaC**: `provision-{dynamodb,s3,sqs,sns}.sh` provisionam os
  recursos com a mesma config estrutural hoje aplicada pelo `init.sh` ao Floci (3 tabelas +
  TTL, bucket + block public + lifecycle + CORS, fila + DLQ + redrive, tópico + subscription).
  Rodar cada script 2× não altera o resultado nem erra.
- [ ] **CA4 — Anti-drift**: `infra/aws/lib/params.sh` é a fonte única dos nomes/parâmetros
  estruturais e é consumida tanto pelos scripts de produção quanto pelo `infra/local/init.sh`.
- [ ] **CA5 — Task definitions**: `register-task-defs.sh` registra `prolink-api` e
  `prolink-worker` via `aws ecs register-task-definition`, com `taskRoleArn`/`executionRoleArn`
  corretos, **sem** `AWS_ENDPOINT_URL` e **sem** `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`
  no bloco `environment`, e `JWT_SECRET` só via `secrets[].valueFrom`.
- [ ] **CA6 — Secrets Manager**: `provision-secrets.sh` cria/atualiza `prolink/jwt-secret`
  sem gravar o valor no repositório; a execution role tem `secretsmanager:GetSecretValue`
  restrito a esse ARN.
- [ ] **CA7 — Compose limpo**: `docker-compose.prod.yml` não tem `JWT_SECRET` em texto plano
  nem qualquer variável de credencial AWS; comentário explica de onde vêm em cada runtime.
- [ ] **CA8 — Sem regressão de código**: `npm run build` e `npm run lint` passam; nenhum
  arquivo de `apps/*` muda o comportamento (a 021 é infra + docs; a 013 recebe só uma nota).
- [ ] **CA9 — Docs**: `docs/aws.md` (seções "IAM Task Role") deixam de dizer "a detalhar" e
  listam ações/ARNs reais apontando para `infra/aws/`; `deploy.md` descreve o fluxo Fargate
  (ECR + task def + role) e remove a orientação de credenciais via env do host; `README.md`
  marca as env vars AWS estáticas como dev-only.
- [ ] **CA10 — Verificação**: todos os `infra/aws/*.sh` passam `sh -n` e `shellcheck` sem
  erros; todos os `iam/*.json` e `ecs/*.taskdef.json` são JSON válido e validam contra o
  formato esperado (`aws iam validate-policy`/`accessanalyzer validate-policy` quando houver
  credencial; senão validação estrutural com `jq` + checklist de revisão). O `apply` real na
  conta AWS é passo manual documentado em `deploy.md`, executado pelo usuário.

## Notas

- **Tamanho**: apesar de `medium` no frontmatter, é uma spec grande. `todo.md` deve ser
  organizado em 4 fases, com o batch podendo pausar entre elas:
  1. `lib/` + `params.sh` + recursos base (`dynamodb`, `s3`, `sqs`, `sns`) + anti-drift no `init.sh`.
  2. IAM (roles, policies, trust) + log groups.
  3. Secrets Manager + task definitions + `register-task-defs.sh` + `provision-all.sh`.
  4. `docker-compose.prod.yml` + docs (`aws.md`, `deploy.md`, `README.md`) + nota na 013 + verificação.
  Se ficar grande demais, dividir em **021a** (fases 1–2) e **021b** (fases 3–4).
- **Shell + CLI vs. CloudFormation/Terraform** (decisão do usuário): mantém a convenção do
  repo (`infra/local/init.sh`, `infra/aws/set-cors-producao.sh`), zero toolchain nova, zero
  state file para gerir. Trade-off aceito: sem *drift detection* nem *rollback* automáticos —
  mitigado por idempotência (`create-or-update`), `params.sh` como fonte única, e o conjunto
  pequeno e estável de recursos. Se a infra AWS crescer (múltiplos ambientes, VPC, ALB),
  reavaliar CloudFormation numa spec futura.
- **Relação com a Spec 019**: a 019 garante que, sem `AWS_ENDPOINT_URL`, `awsClientConfig()`
  não injeta `credentials` → o SDK v3 usa o *container credentials provider* (metadata do ECS)
  = a Task Role desta spec. Sem a 019, o código ainda montaria `credentials` inline e a Task
  Role seria ignorada. Ordem obrigatória: 018 → 019 → 021.
- **Relação com a Spec 013**: o worker ainda não existe. Esta spec **define** a
  `prolink-worker-task-role` e a `worker.taskdef.json` (menor privilégio já desenhado), mas
  **deployar** o serviço worker no Fargate e produzir a imagem ECR é da 013. A 013 ganha uma
  nota apontando para cá e para o padrão `awsClientConfig()` da 019 (o `apps/worker/src/aws.ts`
  deve espelhá-lo, não reinventar a montagem de credenciais).
- **Fora desta spec, mas no radar** (candidatos a 021b / spec de rede):
  - Cluster ECS, services (`api`, `worker`, futuramente `web`), ALB + TLS (ACM), Security
    Groups, subnets privadas + NAT/VPC endpoints (DynamoDB/S3 gateway endpoints reduzem custo
    e superfície).
  - Task definition do `web` em Fargate (hoje o `web` não tem acesso AWS — só precisa de
    `JWT_SECRET` para o `middleware.ts`).
  - Pipeline de build/push para o ECR (hoje `docker compose build` local).
  - Alarmes CloudWatch (profundidade da fila, DLQ > 0, erros 5xx da API).
- **SES**: a identidade `contato@prolinkcontabil.com.br` e a saída do sandbox são ações
  manuais (DNS + ticket AWS) — a IaC só cria a subscription do SNS; documentar o pré-requisito.
- **`AWS_ACCOUNT_ID`**: nunca chumbado nos JSON — resolvido em runtime por
  `aws sts get-caller-identity --query Account` no `common.sh` e injetado nos placeholders.
