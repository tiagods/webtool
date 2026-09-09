# Recursos AWS — Prolink Contábil

Mapeamento de todos os recursos AWS utilizados no projeto, com configuração, segurança e estimativa de custo.

> **Ambiente local:** todos os recursos são emulados via **Floci** (`floci/floci:latest`) na porta 4566. Scripts de provisionamento em `infra/local/`.
>
> **Autenticação em produção:** IAM Role (não IAM user com chaves) quando possível. `apps/backend` (binário Go `cmd/api`) e `apps/worker` (`cmd/worker` do mesmo módulo Go) rodam como containers Docker na mesma stack (Lightsail hoje; Fargate no futuro). O SDK Go usa a cadeia de credenciais padrão (IAM role do host/task) quando `AWS_ENDPOINT_URL` está **ausente** — `config.AWS.UsesCustomEndpoint()` só é `true` no local (Floci), onde `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` passam a ser obrigatórias. Nenhuma chave hardcoded em produção. O `apps/worker` **não é Lambda** — é um processo long-running que faz long-polling na SQS (ver seção "Worker" e [`013-worker-pdf-email.md`](../.claude/specs/013-worker-pdf-email.md)).
>
> **Config:** toda variável de ambiente é lida e validada uma única vez em `apps/backend/infrastructure/config` (boot falha rápido com erro agregado listando o que falta). Variáveis: `APP_ENV` (`dev`|`prod`), `JWT_SECRET`, `PORT`, `SESSION_EXPIRY_SECONDS`, `AWS_REGION`, `AWS_DYNAMODB_TABLE`, `AWS_DYNAMODB_ALTERACAO_TABLE`, `AWS_DYNAMODB_ACEITES_TABLE`, `AWS_S3_BUCKET`, `AWS_SQS_QUEUE_URL` e (só local) `AWS_ENDPOINT_URL` + chaves estáticas.

---

## Visão geral

```
Browser
  │
  ├─ PUT (presigned) ──────────────────────────────────→ S3
  │
  └─ apps/backend (container)
        │
        ├─ DynamoDB   ← rascunhos, aceites LGPD, contador de protocolo
        ├─ S3         ← documentos dos sócios + backup JSON/PDF
        ├─ SQS        ← fila de processamento assíncrono
        │
        └─ apps/worker (container — long-polling na SQS)
              ├─ DynamoDB   ← lê payload, zera dados sensíveis, atualiza status
              ├─ S3         ← salva PDF gerado
              └─ SNS        ← publica evento de e-mail
                    │
                    └─ SES subscription ← envia e-mail ao cliente
```

---

## DynamoDB

**Tabela:** `fichas-abertura`
**Modo:** On-demand (PAY_PER_REQUEST)
**Região:** `us-east-1`

### Chaves

| Atributo | Tipo | Papel |
|---|---|---|
| `sessionId` | String | Partition Key |
| `sk` | String | Sort Key (a definir: necessário para aceites LGPD conviverem com rascunhos) |

### Tipos de item e TTL

| Tipo | `status` / `sk` | TTL | Motivo |
|---|---|---|---|
| Rascunho | `rascunho` | **2h** após criação | Dado temporário — sessão expira |
| Submetido | `enviado` | **30 dias** após submit | Backup real está no S3; `payload` zerado no submit |
| Aceite LGPD | `aceite#v1.0` | **5 anos** após aceite | Prova jurídica obrigatória (LGPD Art. 7, §5º) |
| Contador | `COUNTER` | **Sem TTL** | Sequencial acumulativo de protocolo |

> O atributo TTL é um Unix timestamp em segundos. A deleção pelo DynamoDB ocorre em até 48h após o timestamp — comportamento esperado e aceitável para conformidade LGPD.
>
> **Após submit:** `payload` e `documentosKeys` são zerados (`null`) no mesmo `UpdateItem` que muda o status. O worker também zera esses campos ao processar (defesa em profundidade).

### Segurança

- Acesso exclusivo via IAM Role do host (container `api` / container `worker`)
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
**Acesso:** Privado — sem acesso público

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
      ficha.pdf       ← PDF gerado pelo worker
```

> Prefixo `{sessionId}/` é temporário. No submit, os objetos são copiados para `protocolos/{protocolo}/` e o prefixo da sessão é deletado imediatamente.

### CORS

Apenas operações de upload do browser. Sem acesso GET via CORS.

| AllowedMethods | `PUT`, `HEAD` |
|---|---|
| AllowedOrigins | `https://prolinkcontabil.com.br` (produção) / `http://localhost:3000` (local) |
| AllowedHeaders | `Content-Type`, `Content-Length`, `x-amz-*` |

Em dev, o CORS é aplicado automaticamente pelo `infra/local/init.sh` (origin fixo `http://localhost:3000`). Em produção, o script executável é [`infra/aws/set-cors-producao.sh`](../infra/aws/set-cors-producao.sh) (parametrizado por `PROD_ORIGIN`, ver [`deploy.md`](../deploy.md)) — não reaproveita o script de dev pois este também provisiona tabelas/filas que já existem em produção.

### Lifecycle Rules

| Rule | Prefixo | Ação |
|---|---|---|
| `delete-rascunhos-abandonados` | `""` (todos) | Delete após **30 dias** |

Objetos em `protocolos/` são permanentes (sem regra de expiração) — retidos pelo prazo legal contábil (5 anos).

### Segurança

- Acesso a documentos exclusivamente via **presigned PUT URL** (validade 5 min) — servidor gera, browser executa
- `key` da presigned URL nunca é retornada ao cliente — derivada server-side de `sessionId + campo`
- `campo` validado com `/^[a-z0-9_]{1,80}$/` antes de compor a key (previne path traversal)
- Encryption at rest: SSE-S3 (padrão)
- Acesso via IAM Role (sem chaves de acesso)

### Estimativa de custo — 100 submissões/mês

| Item | Estimativa | Custo/mês |
|---|---|---|
| Storage docs (~5MB/submissão) | 500MB | ~$0,012 |
| Storage PDFs + JSONs (~1MB/submissão) | 100MB | ~$0,002 |
| PUT requests (uploads + backups) | ~800 | ~$0,004 |
| GET requests (presigned downloads) | ~200 | ~$0,0001 |
| **Total** | | **~$0,02** |

---

## SQS

**Fila:** `prolink-abertura`
**Tipo:** Standard
**Região:** `us-east-1`

### Configuração

| Parâmetro | Valor | Motivo |
|---|---|---|
| `VisibilityTimeout` | 120s | Janela de processamento do worker (geração de PDF) |
| `MessageRetentionPeriod` | 86400s (24h) | Reprocessamento em caso de falha |
| `MaxReceiveCount` (DLQ) | 5 | Redireciona para `prolink-abertura-dlq` após 5 falhas |

### Payload da mensagem

```json
{ "sessionId": "uuid", "protocolo": "PRO-2026-000001", "tipo": "ltda", "formType": "abertura" }
```

> Não inclui dados pessoais — o worker busca o payload no DynamoDB/S3 usando o `sessionId`.

### Segurança

- Acesso via IAM Role (container `api` escreve, container `worker` lê)
- Sem acesso público

### Estimativa de custo — 100 submissões/mês

100 mensagens/mês → gratuito (1 milhão de requests/mês no free tier permanente).

---

## SNS

**Tópico:** `prolink-abertura-emails`
**Tipo:** Standard
**Região:** `us-east-1`

### Assinaturas

| Protocolo | Endpoint | Propósito |
|---|---|---|
| `email` (SES) | `contato@prolinkcontabil.com.br` | Notificação de nova ficha recebida |

> O worker **não chama o SES diretamente** — publica no SNS. O SES é uma subscription do tópico. Isso desacopla o worker do e-mail e permite adicionar outras subscriptions no futuro (ex: webhook, Slack).

### Segurança

- Acesso via IAM Role (worker publica, ninguém mais)
- Sem acesso público

### Estimativa de custo — 100 submissões/mês

100 publicações/mês → gratuito (1 milhão de publicações/mês no free tier permanente).

---

## SES

**Identidade verificada:** `contato@prolinkcontabil.com.br`
**Região:** `us-east-1`
**Modo:** Production (sandbox desativado em produção)

### Uso

Recebe mensagens do SNS via subscription e entrega o e-mail ao destinatário final. O corpo do e-mail inclui resumo da ficha e links dos documentos no S3.

### Estimativa de custo — 100 submissões/mês

100 e-mails/mês × $0,10/1.000 = **$0,01/mês**.

---

## Fargate (containers)

**Cluster:** `prolink-web`
**Task Definition:** `prolink-web-task`
**Região:** `us-east-1`

### Configuração (referência — detalhar no futuro)

| Parâmetro | Valor provisório |
|---|---|
| CPU | 0.25 vCPU |
| Memória | 512MB |
| Imagem | Build do `apps/web` (Dockerfile a criar) |
| Porta | 3000 |

### IAM Task Role

A task do Fargate recebe permissões via **Task Role** — sem `AWS_ACCESS_KEY_ID` ou `AWS_SECRET_ACCESS_KEY` em variáveis de ambiente ou código. O SDK da AWS (Go, em `apps/backend`) detecta as credenciais automaticamente via metadata do container quando `AWS_ENDPOINT_URL` não está definido.

**Permissões necessárias (a detalhar):**

| Serviço | Ações |
|---|---|
| DynamoDB | `GetItem`, `PutItem`, `UpdateItem` na tabela `fichas-abertura` |
| S3 | `PutObject`, `GetObject`, `DeleteObject`, `CopyObject` no bucket `prolink-fichas` |
| SQS | `SendMessage` na fila `prolink-abertura` |

> **Princípio do menor privilégio:** cada role recebe apenas as ações necessárias nos recursos específicos — sem wildcards (`*`).

---

## Worker (consumidor SQS)

**Serviço:** `apps/worker` — **container Docker** na mesma stack Compose (nginx + web + api + worker)
**Runtime:** Node.js 20.x — processo long-running (não Lambda)
**Região:** `us-east-1`
**Consumo:** long-polling `ReceiveMessage` na fila `prolink-abertura` (`WaitTimeSeconds: 20`)

> **Por que container e não Lambda:** nenhuma IaC/pipeline de função gerenciada existe no repositório; a stack já é Docker Compose; o volume (~100 fichas/mês) não justifica escala a zero. A função `processMessage()` é isolada do loop de polling e recebe dependências por injeção — migrar para Lambda no futuro é um wrapper fino sobre a mesma função. Ver [`013-worker-pdf-email.md`](../.claude/specs/013-worker-pdf-email.md).

### IAM Role (do host / task)

| Serviço | Ações |
|---|---|
| DynamoDB | `GetItem`, `UpdateItem` na tabela `fichas-abertura` |
| S3 | `GetObject`, `PutObject`, `CopyObject`, `DeleteObject` no bucket `prolink-fichas` |
| SNS | `Publish` no tópico `prolink-abertura-emails` |
| SQS | `ReceiveMessage`, `DeleteMessage`, `GetQueueAttributes` na fila `prolink-abertura` |

### Configuração

| Parâmetro | Valor |
|---|---|
| Concorrência | 1 container, `MaxNumberOfMessages: 5` por poll (processadas em paralelo) |
| `VisibilityTimeout` | 120s (definido na fila) |
| Retry | Nativo do SQS — sem `DeleteMessage` em falha, a mensagem reentrega |
| DLQ | `prolink-abertura-dlq`, `maxReceiveCount: 5` |
| Shutdown | `SIGTERM` encerra o loop após terminar as mensagens em voo |

### Estimativa de custo

Container na mesma instância Lightsail dos demais serviços — **sem custo AWS adicional** (não há invocações Lambda faturadas). Um container ocioso fazendo long-polling consome recursos desprezíveis na instância já contratada.

---

## Resumo de custo — 100 submissões/mês

| Serviço | Custo/mês |
|---|---|
| DynamoDB | < $0,01 |
| S3 | ~$0,02 |
| SQS | $0,00 (free tier) |
| SNS | $0,00 (free tier) |
| SES | ~$0,01 |
| Worker | $0,00 (container na instância já contratada) |
| **AWS (total)** | **~$0,03** |
| Hospedagem (Lightsail — nginx + web + api + worker 24/7) | ~$8–12 (a calcular com sizing definitivo) |
| **Total geral** | **~$8–12/mês** |

> A hospedagem dos containers domina o custo total. Os serviços gerenciados (DynamoDB, S3, SQS, SNS, SES) somam centavos — escalam sem custo significativo até milhares de submissões/mês.
