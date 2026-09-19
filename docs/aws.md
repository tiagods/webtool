# Recursos AWS — Prolink Contábil

Mapeamento de todos os recursos AWS utilizados no projeto, com configuração, segurança e estimativa de custo.

> **Ambiente local:** todos os recursos são emulados via **Floci** (`floci/floci:latest`) na porta 4566. Scripts de provisionamento em `infra/local/`.
>
> **Autenticação em produção:** sempre por **IAM Role** — nunca IAM user com chaves. `apps/backend` (binário Go `cmd/api`) e `cmd/worker` rodam como tasks Fargate; o SDK Go v2 usa a cadeia de credenciais padrão e resolve a **Task Role** pelo endpoint de metadados do container quando `AWS_ENDPOINT_URL` está **ausente**. No local (Floci), `AWS_ENDPOINT_URL` está definido e `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` passam a ser obrigatórias. Nenhuma chave hardcoded em produção. O worker **não é Lambda** — é um processo long-running que faz long-polling na SQS (ver seção "Worker").
>
> **IaC de produção:** os recursos reais (DynamoDB, S3, SQS, IAM, Secrets Manager e task definitions) são provisionados de forma idempotente pelos scripts em [`infra/aws/`](../infra/aws/) — ver seção "IaC de produção".
>
> **Config:** toda variável de ambiente é lida e validada uma única vez em `apps/backend/infrastructure/config` (boot falha rápido com erro agregado listando o que falta). Variáveis: `APP_ENV` (`dev`|`prod`), `JWT_SECRET`, `PORT`, `SESSION_EXPIRY_SECONDS`, `AWS_REGION`, `AWS_DYNAMODB_TABLE`, `AWS_DYNAMODB_ALTERACAO_TABLE`, `AWS_DYNAMODB_ACEITES_TABLE`, `AWS_S3_BUCKET`, `AWS_SQS_QUEUE_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_TO` e (só local) `AWS_ENDPOINT_URL` + chaves estáticas.

---

## Visão geral

```
Browser
  │
  ├─ PUT (presigned) ──────────────────────────────────→ S3
  │
  └─ apps/backend (task Fargate — cmd/api)
        │
        ├─ DynamoDB   ← rascunhos, aceites LGPD, contador de protocolo
        ├─ S3         ← documentos dos sócios + backup JSON
        └─ SQS        ← fila de processamento assíncrono
              │
              └─ apps/backend (task Fargate — cmd/worker, long-polling na SQS)
                    ├─ DynamoDB   ← lê payload, zera dados sensíveis, atualiza status
                    ├─ S3         ← assina URLs de download dos documentos
                    └─ SMTP       ← envia e-mail de notificação
```

> Não há SNS nem SES: o worker envia e-mail **diretamente via SMTP**.

---

## DynamoDB

**Tabelas:** `fichas-abertura`, `fichas-alteracao`, `prolink-aceites-lgpd`
**Modo:** On-demand (PAY_PER_REQUEST)
**Região:** `us-east-1`

### Chaves

| Tabela | Partition Key | Sort Key |
|---|---|---|
| `fichas-abertura` | `sessionId` (S) | — |
| `fichas-alteracao` | `sessionId` (S) | — |
| `prolink-aceites-lgpd` | `sessionId` (S) | `versaoTermo` (S) |

### Tipos de item e TTL

| Tipo | `status` / `sk` | TTL | Motivo |
|---|---|---|---|
| Rascunho | `rascunho` | **2h** após criação | Dado temporário — sessão expira |
| Submetido | `enviado` | **30 dias** após submit | Backup real está no S3; `payload` zerado no submit |
| Aceite LGPD | `aceite#v1.0` | **5 anos** após aceite | Prova jurídica obrigatória (LGPD Art. 7, §5º) |
| Contador | `COUNTER` | **Sem TTL** | Sequencial acumulativo de protocolo |

> O atributo TTL é um Unix timestamp em segundos (`ttl`). A deleção pelo DynamoDB ocorre em até 48h após o timestamp — comportamento esperado e aceitável para conformidade LGPD.
>
> **Após submit:** `payload` e `documentosKeys` são zerados (`null`) no mesmo `UpdateItem` que muda o status. O worker também zera esses campos ao processar (defesa em profundidade).

### Segurança

- Acesso exclusivo via **IAM Task Role** da task (`prolink-api-task-role` / `prolink-worker-task-role`) — sem chaves de acesso
- Point-in-Time Recovery (PITR) habilitado
- Sem acesso público
- Encryption at rest habilitada por padrão na AWS
- `ConditionExpression` no submit previne sobrescrita de sessão já enviada

### Estimativa de custo — 100 submissões/mês

**Premissas:** 5 leituras + 2 escritas por submissão, item médio ~4KB

| Operação | Cálculo | RUs/mês |
|---|---|---|
| Escrita (1 WRU/KB) | 100 × 2 writes × 4KB | 800 WRUs |
| Leitura eventual (1 RRU/4KB) | 100 × 5 reads × 1 RRU | 500 RRUs |

| Item | Custo/mês | Custo/ano |
|---|---|---|
| 800 WRUs × $1,25/milhão | $0,000001 | $0,000012 |
| 500 RRUs × $0,25/milhão | $0,0000001 | $0,0000015 |
| Storage ~500KB | $0,00 | $0,00 |
| **Total** | **< $0,01** | **~$0,014** |

> **Decisão arquitetural:** S3 como substituto do DynamoDB foi avaliado e descartado. Custo idêntico, mas DynamoDB oferece contador atômico (protocolo sem duplicatas), TTL nativo por item, e escrita condicional — funcionalidades que o S3 não suporta nativamente.

---

## S3

**Bucket:** `prolink-fichas`
**Região:** `us-east-1`
**Acesso:** Privado — sem acesso público (Block Public Access nos 4 flags)

### Organização de prefixos

```
prolink-fichas/
  {sessionId}/
    documentos/
      socio_0_rg_frente.pdf
      socio_0_rg_verso.pdf
      socio_0_cpf.pdf
      imovel_iptu.pdf
      ...
  protocolos/
    {protocolo}/
      ficha.json      ← backup imutável do payload no momento do submit
```

> Prefixo `{sessionId}/` é temporário. No submit, os objetos são copiados para `protocolos/{protocolo}/` e o prefixo da sessão é deletado imediatamente.

### CORS

Apenas operações de upload do browser. Sem acesso GET via CORS.

| AllowedMethods | `PUT`, `HEAD` |
|---|---|
| AllowedOrigins | `https://prolinkcontabil.com.br` (produção) / `http://localhost:3000` (local) |
| AllowedHeaders | `Content-Type`, `Content-Length`, `x-amz-*` |

Em dev, o CORS é aplicado automaticamente pelo `infra/local/init.sh` (origin fixo `http://localhost:3000`). Em produção, o CORS é aplicado por [`infra/aws/provision-s3.sh`](../infra/aws/provision-s3.sh) (parametrizado por `PROD_ORIGIN`); [`infra/aws/set-cors-producao.sh`](../infra/aws/set-cors-producao.sh) foi mantido como wrapper de compatibilidade.

### Lifecycle Rules

| Rule | Filtro | Ação |
|---|---|---|
| `delete-rascunhos-abandonados` | tag `retention=rascunho` | Delete após **30 dias** |

> O filtro é **por tag** (não por prefixo): no submit, o `CopyObject` para `protocolos/{protocolo}/` usa `TaggingDirective=REPLACE` e remove a tag, então os backups finais **nunca** são alcançados pela regra (LGPD Art. 16).

### Segurança

- Acesso a documentos exclusivamente via **presigned PUT URL** (validade 5 min) — servidor gera, browser executa
- `key` da presigned URL nunca é retornada ao cliente — derivada server-side de `sessionId + campo`
- `campo` validado com `/^[a-z0-9_]{1,80}$/` antes de compor a key (previne path traversal)
- Encryption at rest: SSE-S3 (AES256); Versioning habilitado
- Acesso via IAM Task Role (sem chaves de acesso)

### Estimativa de custo — 100 submissões/mês

| Item | Estimativa | Custo/mês |
|---|---|---|
| Storage docs (~5MB/submissão) | 500MB | ~$0,012 |
| Storage JSONs (~0,1MB/submissão) | 10MB | ~$0,0002 |
| PUT requests (uploads + backups) | ~800 | ~$0,004 |
| GET requests (presigned downloads) | ~200 | ~$0,0001 |
| **Total** | | **~$0,016** |

---

## SQS

**Fila:** `prolink-abertura`
**Tipo:** Standard
**Região:** `us-east-1`

### Configuração

| Parâmetro | Valor | Motivo |
|---|---|---|
| `VisibilityTimeout` | 120s | Janela de processamento do worker |
| `MessageRetentionPeriod` | 86400s (24h) | Reprocessamento em caso de falha |
| `MaxReceiveCount` (DLQ) | 5 | Redireciona para `prolink-abertura-dlq` após 5 falhas |
| `prolink-abertura-dlq` | retenção 14 dias | Inspeção/reprocessamento manual pelo operador |

### Payload da mensagem

```json
{ "sessionId": "uuid", "protocolo": "PRO-2026-000001", "tipo": "ltda", "formType": "abertura" }
```

> Não inclui dados pessoais — o worker busca o payload no DynamoDB/S3 usando o `sessionId`.

### Segurança

- Acesso via IAM Task Role (a API publica com `SendMessage`; o worker consome com `ReceiveMessage`/`DeleteMessage`)
- Sem acesso público

### Estimativa de custo — 100 submissões/mês

100 mensagens/mês → gratuito (1 milhão de requests/mês no free tier permanente).

---

## E-mail (SMTP)

O worker envia o e-mail de notificação **diretamente por SMTP** (`apps/backend/infrastructure/email`), com as credenciais `SMTP_*` lidas do `config.go`. **Não há SNS nem SES** nesta arquitetura.

| Parâmetro | Origem |
|---|---|
| `SMTP_HOST`, `SMTP_PORT` | env do taskdef (não secreto) |
| `SMTP_USER` | env do taskdef (não secreto) |
| `SMTP_PASSWORD` | **AWS Secrets Manager** (`prolink/smtp-password`) — `secrets[].valueFrom` |
| `SMTP_FROM`, `SMTP_TO` | env do taskdef (não secreto) |

> O custo do envio depende do provedor SMTP contratado — não é faturado pela AWS.

---

## IaC de produção (`infra/aws/`)

Scripts POSIX idempotentes (`create-or-update`) que provisionam os recursos reais. Rodam a partir de uma máquina autenticada por **role assumida** (SSO/`assume-role`) — `common.sh` recusa identidade `:user/` (break-glass: `PROLINK_ALLOW_IAM_USER=1`). Nomes e parâmetros estruturais vêm da fonte única `infra/aws/lib/params.sh`, compartilhada com o `init.sh` local (anti-drift).

| Script | Provisiona |
|---|---|
| `provision-dynamodb.sh` | 3 tabelas + TTL + PITR |
| `provision-s3.sh` | bucket + Block Public Access + SSE-S3 + Versioning + Lifecycle + CORS |
| `provision-sqs.sh` | fila + DLQ + redrive |
| `provision-iam.sh` | roles, policies e log groups do ECS |
| `provision-secrets.sh` | `prolink/jwt-secret` e `prolink/smtp-password` |
| `register-task-defs.sh` | task definitions Fargate (`prolink-api`, `prolink-worker`) |
| `provision-all.sh` | encadeia tudo na ordem (taskdefs se as imagens forem informadas) |

Ver [`infra/aws/README.md`](../infra/aws/README.md) para o passo a passo.

---

## Fargate (containers)

**Task Definitions:** `prolink-api` e `prolink-worker` (registradas por `infra/aws/register-task-defs.sh`)
**Runtime:** Fargate, `networkMode: awsvpc`
**Região:** `us-east-1`

### Configuração

| Parâmetro | Valor |
|---|---|
| CPU / Memória | 0.25 vCPU / 512MB |
| Imagem `api` | build de `apps/backend/Dockerfile` com `APP=api` |
| Imagem `worker` | build de `apps/backend/Dockerfile` com `APP=worker` |
| Porta (só `api`) | 3001 |

> O cluster, os *services*, o ALB/TLS e a rede (VPC/subnets) **não** são criados por esta spec — são escopo da spec de rede (021b). Aqui ficam apenas as task definitions e as roles.

### IAM Task Role

Cada task recebe permissões via **Task Role** — sem `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` em variáveis ou código. As policies estão versionadas em [`infra/aws/iam/`](../infra/aws/iam/) e usam ARNs explícitos (nenhum `Resource: "*"`).

**`prolink-ecs-execution-role`** (assumida pelo agente ECS): managed `AmazonECSTaskExecutionRolePolicy` (pull no ECR + logs) + `secretsmanager:GetSecretValue` restrito a `prolink/jwt-secret-*` e `prolink/smtp-password-*`.

**`prolink-api-task-role`** (runtime da API):

| Serviço | Ações | Recurso |
|---|---|---|
| DynamoDB | `GetItem`, `PutItem`, `UpdateItem`, `DeleteItem` | `fichas-abertura`, `fichas-alteracao`, `prolink-aceites-lgpd` |
| S3 | `GetObject`, `PutObject`, `DeleteObject`, `PutObjectTagging` | `prolink-fichas/*` |
| S3 | `ListBucket` | `prolink-fichas` |
| SQS | `SendMessage` | `prolink-abertura` |

**`prolink-worker-task-role`** (runtime do worker):

| Serviço | Ações | Recurso |
|---|---|---|
| DynamoDB | `GetItem`, `UpdateItem` | `fichas-abertura`, `fichas-alteracao` |
| S3 | `GetObject` | `prolink-fichas/*` |
| SQS | `ReceiveMessage`, `DeleteMessage` | `prolink-abertura` |

> **Princípio do menor privilégio:** cada role recebe apenas as ações necessárias nos recursos específicos — sem wildcards (`*`). O worker só **assina** URLs de download (`s3:GetObject`); o redrive da DLQ é feito pelo próprio SQS.

---

## Worker (consumidor SQS)

**Serviço:** `cmd/worker` do módulo Go `apps/backend` — **task Fargate**
**Runtime:** binário Go (processo long-running, não Lambda)
**Região:** `us-east-1`
**Consumo:** long-polling `ReceiveMessage` na fila `prolink-abertura` (`WaitTimeSeconds: 20`)

> **Por que task e não Lambda:** a stack já é containerizada; o volume (~100 fichas/mês) não justifica escala a zero. O processamento (`NotificarSubmissao.Processar`) é isolado do loop de polling e recebe dependências por injeção — migrar para Lambda no futuro é um wrapper fino sobre a mesma função.

### IAM Role (Task Role)

| Serviço | Ações |
|---|---|
| DynamoDB | `GetItem`, `UpdateItem` em `fichas-abertura`/`fichas-alteracao` |
| S3 | `GetObject` em `prolink-fichas/*` (assina URLs de download) |
| SQS | `ReceiveMessage`, `DeleteMessage` em `prolink-abertura` |
| SMTP | sem IAM — credenciais via Secrets Manager |

### Configuração

| Parâmetro | Valor |
|---|---|
| Concorrência | 1 task, `MaxNumberOfMessages: 1` por poll |
| `VisibilityTimeout` | 120s (definido na fila) |
| Retry | Nativo do SQS — sem `DeleteMessage` em falha, a mensagem reentrega |
| DLQ | `prolink-abertura-dlq`, `maxReceiveCount: 5` |
| Shutdown | `SIGTERM` encerra o loop |

### Estimativa de custo

Task Fargate 0.25 vCPU / 512MB — ver custo de hospedagem abaixo.

---

## Resumo de custo — 100 submissões/mês

| Serviço | Custo/mês |
|---|---|
| DynamoDB | < $0,01 |
| S3 | ~$0,02 |
| SQS | $0,00 (free tier) |
| E-mail (SMTP externo) | conforme provedor |
| **AWS (total)** | **~$0,03** |
| Hospedagem (Fargate — api + worker 24/7) | a calcular com sizing definitivo |
| **Total geral** | a definir |

> Os serviços gerenciados (DynamoDB, S3, SQS) somam centavos — escalam sem custo significativo até milhares de submissões/mês.
