# Recursos AWS — Prolink Contábil

Mapeamento de todos os recursos AWS utilizados no projeto, com configuração, segurança e estimativa de custo.

> **Ambiente local:** todos os recursos são emulados via **Floci** (`floci/floci:latest`) na porta 4566. Provisionado por Terraform em [`scripts/terraform/local/`](../scripts/terraform/local/), executado pelo container `aws-init`.
>
> **Autenticação em produção:** `apps/backend` (binário Go `cmd/api`) e `cmd/worker` rodam como containers Docker numa **instância Lightsail**, que **não suporta IAM role/instance profile**. Por isso cada serviço usa a access key de um **IAM user próprio** (`ApiApp`, `WorkerApp`), com menor privilégio, injetada pelo `.env` não versionado do servidor. Sem `AWS_ENDPOINT_URL`, o SDK Go v2 usa a cadeia de credenciais padrão, que lê `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` do ambiente. No local (Floci), `AWS_ENDPOINT_URL` está definido e as chaves (fictícias) passam a ser obrigatórias. Nenhuma chave hardcoded ou versionada. O worker **não é Lambda** — é um processo long-running que faz long-polling na SQS (ver seção "Worker").
>
> **IaC de produção:** os recursos reais (DynamoDB, S3, SQS) são provisionados por Terraform em [`scripts/terraform/production/`](../scripts/terraform/production/) — ver seção "IaC de produção".
>
> **Config:** toda variável de ambiente é lida e validada uma única vez em `apps/backend/infrastructure/config` (boot falha rápido com erro agregado listando o que falta). Variáveis: `APP_ENV` (`dev`|`prod`), `JWT_SECRET`, `PORT`, `SESSION_EXPIRY_SECONDS`, `AWS_REGION`, `AWS_DYNAMODB_ABERTURA_TABLE`, `AWS_DYNAMODB_ALTERACAO_TABLE`, `AWS_DYNAMODB_ACEITES_TABLE`, `AWS_S3_BUCKET`, `AWS_SQS_QUEUE_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_TO`, `EMAIL_OUTPUT_DIR` e (só local) `AWS_ENDPOINT_URL` + chaves estáticas. O grupo `SMTP_*` é **opcional em dev** (sem `SMTP_HOST` o worker cai no fallback de arquivo); com `APP_ENV=prod`, `SMTP_HOST`/`SMTP_FROM`/`SMTP_TO` são obrigatórios.

---

## Visão geral

```
Browser
  │
  ├─ PUT (presigned) ──────────────────────────────────→ S3
  │
  └─ apps/backend (container no Lightsail — cmd/api)
        │
        ├─ DynamoDB   ← rascunhos, aceites LGPD, contador de protocolo
        ├─ S3         ← documentos dos sócios + backup JSON
        └─ SQS        ← fila de processamento assíncrono
              │
              └─ apps/backend (container no Lightsail — cmd/worker, long-polling na SQS)
                    ├─ DynamoDB   ← lê payload, zera dados sensíveis, atualiza status
                    ├─ S3         ← assina URLs de download dos documentos
                    └─ SMTP       ← envia e-mail de notificação
```

> Não há SNS nem SES: o worker envia e-mail **diretamente via SMTP**.

---

## DynamoDB

**Tabelas:** `FichasAbertura`, `FichasAlteracao`, `AceitesLgpd`
**Modo:** On-demand (PAY_PER_REQUEST)
**Região:** `us-east-1`

### Chaves

| Tabela | Partition Key | Sort Key |
|---|---|---|
| `FichasAbertura` | `sessionId` (S) | — |
| `FichasAlteracao` | `sessionId` (S) | — |
| `AceitesLgpd` | `sessionId` (S) | `versaoTermo` (S) |

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

- Acesso exclusivo pelos IAM users da aplicação (`ApiApp` / `WorkerApp`), com menor privilégio
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

Em dev, o CORS é aplicado pelo Terraform local (origin `http://localhost:3000`). Em produção, pelo Terraform de `production` (variável `cors_allowed_origins`).

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
- Acesso exclusivo pelos IAM users da aplicação (`ApiApp` / `WorkerApp`)

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

**Fila:** `FichasSubmissoes`
**Tipo:** Standard
**Região:** `us-east-1`

### Configuração

| Parâmetro | Valor | Motivo |
|---|---|---|
| `VisibilityTimeout` | 120s | Janela de processamento do worker |
| `MessageRetentionPeriod` | 86400s (24h) | Reprocessamento em caso de falha |
| `MaxReceiveCount` (DLQ) | 5 | Redireciona para `FichasSubmissoesDLQ` após 5 falhas |
| `FichasSubmissoesDLQ` | retenção 14 dias | Inspeção/reprocessamento manual pelo operador |

### Payload da mensagem

```json
{ "sessionId": "uuid", "protocolo": "PRO-2026-000001", "tipo": "ltda", "formType": "abertura" }
```

> Não inclui dados pessoais — o worker busca o payload no DynamoDB/S3 usando o `sessionId`.

### Segurança

- Acesso via IAM users da aplicação (a API publica com `SendMessage`; o worker consome com `ReceiveMessage`/`DeleteMessage`)
- Sem acesso público

### Estimativa de custo — 100 submissões/mês

100 mensagens/mês → gratuito (1 milhão de requests/mês no free tier permanente).

---

## E-mail (SMTP)

O worker envia o e-mail de notificação **diretamente por SMTP** (`apps/backend/infrastructure/email`), com as credenciais `SMTP_*` lidas do `config.go`. **Não há SNS nem SES** nesta arquitetura.

> **Fallback dev (spec 035):** sem `SMTP_HOST`, o worker não usa SMTP — grava o HTML da notificação (mesmo corpo, com links presigned) como arquivo `<YYYYMMDDTHHMMSSZ>_<slug-do-Subject>.html` em `EMAIL_OUTPUT_DIR` (default: temp do SO — `/tmp` dentro do container dev). Nada é escrito no repositório; para inspecionar: `docker exec prolink-worker ls /tmp` ou `docker cp`. Em `APP_ENV=prod` o fallback não existe: `SMTP_HOST` é obrigatória no boot.

| Parâmetro | Origem |
|---|---|
| `SMTP_HOST`, `SMTP_PORT` | `.env` do servidor (não secreto) |
| `SMTP_USER` | `.env` do servidor (não secreto) |
| `SMTP_PASSWORD` | `.env` do servidor (**secreto**, não versionado) |
| `SMTP_FROM`, `SMTP_TO` | `.env` do servidor (não secreto) |

> O custo do envio depende do provedor SMTP contratado — não é faturado pela AWS.

---

## IaC (`scripts/terraform/`)

Terraform com um módulo compartilhado (`modules/dados`: DynamoDB, S3, SQS) e dois roots: `local` (Floci, rodado pelo `aws-init`) e `production` (AWS real, rodado à mão pelo operador com **role assumida**). Local e produção instanciam o mesmo módulo, então schema, lifecycle e filas não divergem; o que difere (PITR, endurecimento do bucket, CORS) entra por variável. O `production` também cria os IAM users `ApiApp` e `WorkerApp` com as policies de "IAM — credenciais da aplicação", mas **não** as access keys.

### Padrão de nomenclatura

1. **PascalCase** nos recursos que aceitam maiúsculas (DynamoDB, SQS, IAM).
2. **Sem prefixo `prolink-`** — a conta AWS é dedicada à organização.
3. **Exceções impostas pela AWS**: S3 (nome globalmente único + só minúsculas) mantém `prolink-fichas`.
4. **Fonte única de nomes**: defaults das variáveis em `scripts/terraform/modules/dados/variables.tf`.

Ver [`scripts/terraform/README.md`](../scripts/terraform/README.md) para o passo a passo.

---

## Lightsail (hospedagem)

**Runtime:** uma instância Lightsail com Docker rodando `docker-compose.prod.yml` (`web`, `api`, `worker`, `nginx`, `caddy`)
**Imagens:** buildadas no próprio servidor (`docker compose up --build`) — sem container registry
**Rede:** IP estático da instância; firewall do Lightsail libera só 22/80/443
**Região:** `us-east-1`

| Parâmetro | Valor |
|---|---|
| Imagem `api` | build de `apps/backend/Dockerfile` com `APP=api` |
| Imagem `worker` | build de `apps/backend/Dockerfile` com `APP=worker` |
| Porta (só `api`) | 3001 (publicada no host, bloqueada no firewall) |

### IAM — credenciais da aplicação

O Lightsail não anexa IAM role à instância, então cada serviço usa a access key de um **IAM user próprio**, passada pelo `.env` do servidor (`API_AWS_*` / `WORKER_AWS_*`, repassadas pelo Compose como `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`). As policies usam ARNs explícitos (nenhum `Resource: "*"`).

**`ApiApp`** (runtime da API):

| Serviço | Ações | Recurso |
|---|---|---|
| DynamoDB | `GetItem`, `PutItem`, `UpdateItem`, `DeleteItem` | `FichasAbertura`, `FichasAlteracao`, `AceitesLgpd` |
| S3 | `GetObject`, `PutObject`, `DeleteObject`, `PutObjectTagging` | `prolink-fichas/*` |
| S3 | `ListBucket` | `prolink-fichas` |
| SQS | `SendMessage` | `FichasSubmissoes` |

**`WorkerApp`** (runtime do worker):

| Serviço | Ações | Recurso |
|---|---|---|
| DynamoDB | `GetItem`, `UpdateItem` | `FichasAbertura`, `FichasAlteracao` |
| S3 | `GetObject` | `prolink-fichas/*` |
| SQS | `ReceiveMessage`, `DeleteMessage` | `FichasSubmissoes` |

> **Princípio do menor privilégio:** cada user recebe apenas as ações necessárias nos recursos específicos — sem wildcards (`*`). O worker só **assina** URLs de download (`s3:GetObject`); o redrive da DLQ é feito pelo próprio SQS.

---

## Worker (consumidor SQS)

**Serviço:** `cmd/worker` do módulo Go `apps/backend` — **container no Lightsail**
**Runtime:** binário Go (processo long-running, não Lambda)
**Região:** `us-east-1`
**Consumo:** long-polling `ReceiveMessage` na fila `FichasSubmissoes` (`WaitTimeSeconds: 20`)

> **Por que container e não Lambda:** a stack já é containerizada; o volume (~100 fichas/mês) não justifica escala a zero. O processamento (`NotificarSubmissao.Processar`) é isolado do loop de polling e recebe dependências por injeção — migrar para Lambda no futuro é um wrapper fino sobre a mesma função.

### IAM (user `WorkerApp`)

| Serviço | Ações |
|---|---|
| DynamoDB | `GetItem`, `UpdateItem` em `FichasAbertura`/`FichasAlteracao` |
| S3 | `GetObject` em `prolink-fichas/*` (assina URLs de download) |
| SQS | `ReceiveMessage`, `DeleteMessage` em `FichasSubmissoes` |
| SMTP | sem IAM — credenciais via `.env` do servidor |

### Configuração

| Parâmetro | Valor |
|---|---|
| Concorrência | 1 container, `MaxNumberOfMessages: 1` por poll |
| `VisibilityTimeout` | 120s (definido na fila) |
| Retry | Nativo do SQS — sem `DeleteMessage` em falha, a mensagem reentrega |
| DLQ | `FichasSubmissoesDLQ`, `maxReceiveCount: 5` |
| Shutdown | `SIGTERM` encerra o loop |

### Estimativa de custo

Roda na mesma instância Lightsail — ver custo de hospedagem abaixo.

---

## Resumo de custo — 100 submissões/mês

| Serviço | Custo/mês |
|---|---|
| DynamoDB | < $0,01 |
| S3 | ~$0,02 |
| SQS | $0,00 (free tier) |
| E-mail (SMTP externo) | conforme provedor |
| **AWS (total)** | **~$0,03** |
| Hospedagem (instância Lightsail — stack completa 24/7) | conforme o plano escolhido |
| **Total geral** | a definir |

> Os serviços gerenciados (DynamoDB, S3, SQS) somam centavos — escalam sem custo significativo até milhares de submissões/mês.
