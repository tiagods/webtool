---
id: "037"
title: "Nomenclatura padrão dos recursos AWS (PascalCase, sem prefixo prolink)"
status: draft
created: 2026-09-27
author: "Tiago"
batch_size: "small"
depends_on: []
prefer_after: []
touches:
  - "infra/**"
  - "docker-compose.yml"
  - "docker-compose.prod.yml"
  - "apps/backend/infrastructure/config/**"
  - "scripts/test/**"
  - "docs/aws.md"
  - "deploy.md"
  - ".claude/specs/037-*.md"
---

# Nomenclatura padrão dos recursos AWS (PascalCase, sem prefixo prolink)

## Contexto

Os nomes dos recursos AWS no repositório são inconsistentes:

- **Prefixo `prolink-` aplicado aos acaso** — presente na fila, DLQ, roles, log groups,
  families, ECR e secrets; ausente nas tabelas `fichas-abertura`/`fichas-alteracao`. A conta
  AWS de produção é **dedicada à organização**, então o prefixo não agrega isolamento.
- **Nomes que induzem a erro** — a fila única `prolink-abertura` carrega mensagens de
  **abertura e alteracao** (o worker ramifica por `formType`), e a env var `AWS_DYNAMODB_TABLE`
  não diz qual tabela aponta (é a de abertura).
- **Nomes espalhados** — `infra/aws/lib/params.sh` é a fonte única (princípio da spec 021),
  mas `infra/local/validate.sh` e os scripts de teste **hardcodeiam** os nomes em vez de
  lerem de `params.sh` — exatamente o drift que o princípio existe para impedir.

## Objetivo

Definir um **padrão de nomenclatura** dos recursos AWS — **PascalCase, sem o prefixo
`prolink`**, nomes claros refletindo o domínio — e aplicá-lo ao **plano de dados e de
controle**, atualizando todos os consumidores no repositório (scripts, task definitions,
config Go, compose, scripts de teste e documentação).

Regras do padrão:

1. **PascalCase** nos recursos que aceitam maiúsculas (DynamoDB, SQS, IAM, CloudWatch,
   Secrets Manager).
2. **Sem prefixo `prolink-`** — a conta AWS é dedicada à organização.
3. **Exceções impostas pela AWS**: S3 (nome global + só minúsculas) mantém `prolink-fichas`;
   ECR (só minúsculas) usa `api`/`worker`.
4. **Um nome por conceito, definido em `params.sh`** — nenhum nome hardcodeado fora da
   fonte única.

### Nomenclatura aprovada

| Recurso | Hoje | Novo |
|---------|------|------|
| DynamoDB (abertura) | `fichas-abertura` | `FichasAbertura` |
| DynamoDB (alteracao) | `fichas-alteracao` | `FichasAlteracao` |
| DynamoDB (aceites LGPD) | `prolink-aceites-lgpd` | `AceitesLgpd` |
| S3 bucket | `prolink-fichas` | `prolink-fichas` (mantém) |
| SQS fila | `prolink-abertura` | `FichasSubmissoes` |
| SQS DLQ | `prolink-abertura-dlq` | `FichasSubmissoesDLQ` |
| IAM execution role | `prolink-ecs-execution-role` | `EcsExecutionRole` |
| IAM API task role | `prolink-api-task-role` | `ApiTaskRole` |
| IAM worker task role | `prolink-worker-task-role` | `WorkerTaskRole` |
| Policy inline (execution) | `prolink-secrets-read` | `secrets-read` |
| Policy inline (api) | `prolink-api-task-policy` | `api-task-policy` |
| Policy inline (worker) | `prolink-worker-task-policy` | `worker-task-policy` |
| Log group (api) | `/ecs/prolink-api` | `/ecs/api` |
| Log group (worker) | `/ecs/prolink-worker` | `/ecs/worker` |
| ECS family / ECR (api) | `prolink-api` | `api` |
| ECS family / ECR (worker) | `prolink-worker` | `worker` |
| Secret JWT | `prolink/jwt-secret` | `jwt-secret` |
| Secret SMTP | `prolink/smtp-password` | `smtp-password` |
| Env var (tabela abertura) | `AWS_DYNAMODB_TABLE` | `AWS_DYNAMODB_ABERTURA_TABLE` |

## Fora de escopo

- **S3 bucket `prolink-fichas`** — a AWS impõe nome globalmente único + só minúsculas; o
  prefixo aqui é útil (reduz colisão) e o rename quebraria URLs presignadas históricas.
- **Cookies `prolink_session`/`prolink_aceite` e `container_name` dos Docker Compose** —
  não são recursos AWS; renomear os cookies invalidaria sessões ativas.
- **SNS** — não existe na arquitetura atual (a spec 021 removeu; o worker usa SMTP direto).
- **Migração em AWS real** — produção nunca foi provisionada; os scripts criam os recursos
  direto com os nomes novos (ver Notas para o procedimento caso a produção venha a existir).
- **`docs/arquitetura.md`** — documento defasado (ainda cita SNS e nomes antigos); fica para
  uma spec separada de documentação.
- **Specs passadas** — `.claude/specs/0NN-*.md` não são reescritas.

## Design

### Camadas afetadas

| Camada | Arquivo | Ação |
|--------|---------|------|
| IaC (fonte única) | `infra/aws/lib/params.sh` | MODIFY — defaults novos (dados + controle) |
| IaC (produção) | `infra/aws/provision-{sqs,dynamodb,iam,secrets}.sh` | MODIFY — comentários/cabeçalhos com nomes novos |
| IaC (templates) | `infra/aws/ecs/{api,worker}.taskdef.json` | MODIFY — env `AWS_DYNAMODB_ABERTURA_TABLE` |
| IaC (local) | `infra/local/validate.sh` | MODIFY — `source` do `params.sh` no lugar de nomes hardcodeados |
| Backend (config) | `apps/backend/infrastructure/config/config.go` | MODIFY — tag env `AWS_DYNAMODB_ABERTURA_TABLE` |
| Backend (testes) | `apps/backend/infrastructure/config/config_test.go` | MODIFY — env var + valores novos |
| Compose | `docker-compose.yml`, `docker-compose.prod.yml` | MODIFY — valores, env var e URL da fila |
| Scripts de teste | `scripts/test/dynamodb-query.sh` | MODIFY — nomes das tabelas |
| Docs | `docs/aws.md`, `deploy.md` | MODIFY — nomes (IAM, SQS, ECR, taskdefs, env vars) |

### Detalhes

- **`params.sh`** é o único lugar onde os nomes novos são definidos (defaults). Os scripts
  que já fazem `source` (`init.sh`, `provision-*.sh`, `register-task-defs.sh`) herdam a
  mudança automaticamente.
- **`validate.sh`** é o único consumidor local que hardcodeia nomes (`fichas-abertura`,
  `prolink-fichas`, `prolink-abertura`, `prolink-abertura-dlq`) — passa a fazer `source` de
  `infra/aws/lib/params.sh`, como o `init.sh`, eliminando o drift.
- **`AWS_DYNAMODB_TABLE` → `AWS_DYNAMODB_ABERTURA_TABLE`** em `config.go` (tag `env`),
  task definitions, os dois compose, `deploy.md` e testes. As demais env vars
  (`AWS_DYNAMODB_ALTERACAO_TABLE`, `AWS_DYNAMODB_ACEITES_TABLE`) já têm nomes explícitos —
  mantidas.
- **URL da fila** no `docker-compose.yml`: `http://floci:4566/000000000000/FichasSubmissoes`.
- **ECR**: não há script no repo criando os repositórios (o `deploy.md` documenta o
  `aws ecr create-repository` manual) — atualizar o doc para `api`/`worker` (minúsculas,
  regra do ECR).
- **Sem migração em produção** (nunca provisionada): o `provision-*.sh` cria tudo direto
  com os nomes novos.

### Regras a documentar em `docs/aws.md`

1. PascalCase nos recursos que aceitam maiúsculas; sem prefixo `prolink-`.
2. S3 mantém `prolink-fichas` (nome global + só minúsculas).
3. ECR mantém minúsculas (`api`, `worker`).
4. Fonte única de nomes: `infra/aws/lib/params.sh`.

## Critérios de aceite

- [ ] `params.sh` define todos os defaults novos (tabelas, fila, DLQ, roles, log groups,
      families, secrets)
- [ ] `validate.sh` sem nomes hardcodeados (faz `source` do `params.sh`) e
      `npm run infra:validate` passa após `npm run infra:reset`
- [ ] Env var `AWS_DYNAMODB_ABERTURA_TABLE` usada em todos os pontos (config.go, taskdefs,
      compose, docs) — nenhum resíduo de `AWS_DYNAMODB_TABLE`
- [ ] E2E local (Floci) passando: abertura → SQS `FichasSubmissoes` → worker, e alteracao
- [ ] `docs/aws.md` e `deploy.md` sem nenhum nome antigo residual
- [ ] Gates do escopo tocado verdes:
  - `apps/backend/**` → `make -C apps/backend lint` + `make -C apps/backend test` +
    `docker compose build api`
  - `infra/**`, `scripts/**` → `sh -n` (shellcheck quando disponível) nos scripts tocados

## Notas

- **Nome da fila**: `FichasSubmissoes` — decisão do usuário (rejeitou `FichaAbertura` e
  "duas filas"); a fila única serve os dois formTypes e o nome reflete isso.
- **TTLs/retenção inalterados** (spec 021): rascunho 2h (lifecycle S3 30d), pós-envio 30d,
  **aceites LGPD 5 anos** — `AceitesLgpd` é a tabela com a maior retenção (dados de
  verdade).
- **Migração futura em AWS real** (se a produção vier a existir antes desta spec rodar):
  criar recursos novos → migrar dados (DynamoDB: scan/put ou export; DLQ: drenar mensagens)
  → atualizar taskdefs/roles → apagar os antigos. Fora do escopo desta spec.
- **`docs/arquitetura.md`** continua citando o SNS e nomes antigos — doc defasado, fora do
  escopo.
