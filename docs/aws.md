# Recursos AWS — Prolink Contábil

Mapeamento de todos os recursos AWS utilizados no projeto, com configuração, segurança e estimativa de custo.

> **Ambiente local:** todos os recursos são emulados via **Floci** (`floci/floci:latest`) na porta 4566. Scripts de provisionamento em `infra/local/`.
>
> **Autenticação em produção:** IAM Role (não IAM user com chaves). O Next.js roda em Fargate — a task recebe permissões via Task Role. O Lambda recebe permissões via Execution Role. Nenhuma `AWS_ACCESS_KEY_ID` hardcoded em produção.

---

## Visão geral

```
Browser
  │
  ├─ PUT (presigned) ──────────────────────────────────→ S3
  │
  └─ Next.js (Fargate)
        │
        ├─ DynamoDB   ← rascunhos, aceites LGPD, contador de protocolo
        ├─ S3         ← documentos dos sócios + backup JSON/PDF
        ├─ SQS        ← fila de processamento assíncrono
        │
        └─ Lambda (worker)
              ├─ DynamoDB   ← lê payload, atualiza status
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
> **Após submit:** `payload` e `documentosKeys` são zerados (`null`) no mesmo `UpdateItem` que muda o status. O Lambda worker também zera esses campos ao processar (defesa em profundidade).

### Segurança

- Acesso exclusivo via IAM Role (Fargate Task Role / Lambda Execution Role)
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
      ficha.pdf       ← PDF gerado pelo Lambda
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
| `VisibilityTimeout` | 60s | Janela de processamento do Lambda |
| `MessageRetentionPeriod` | 86400s (24h) | Reprocessamento em caso de falha |
| `MaxReceiveCount` (DLQ) | A definir | Redirecionar para DLQ após N falhas |

### Payload da mensagem

```json
{ "sessionId": "uuid", "protocolo": "PRO-2026-000001", "tipo": "ltda" }
```

> Não inclui dados pessoais — o Lambda busca o payload no DynamoDB/S3 usando o `sessionId`.

### Segurança

- Acesso via IAM Role (Fargate escreve, Lambda lê)
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

> O Lambda **não chama o SES diretamente** — publica no SNS. O SES é uma subscription do tópico. Isso desacopla o worker de e-mail e permite adicionar outras subscriptions no futuro (ex: webhook, Slack).

### Segurança

- Acesso via IAM Role (Lambda publica, ninguém mais)
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

## Fargate (Next.js)

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

A task do Fargate recebe permissões via **Task Role** — sem `AWS_ACCESS_KEY_ID` ou `AWS_SECRET_ACCESS_KEY` em variáveis de ambiente ou código. O SDK da AWS detecta as credenciais automaticamente via metadata do container.

**Permissões necessárias (a detalhar):**

| Serviço | Ações |
|---|---|
| DynamoDB | `GetItem`, `PutItem`, `UpdateItem` na tabela `fichas-abertura` |
| S3 | `PutObject`, `GetObject`, `DeleteObject`, `CopyObject` no bucket `prolink-fichas` |
| SQS | `SendMessage` na fila `prolink-abertura` |

> **Princípio do menor privilégio:** cada role recebe apenas as ações necessárias nos recursos específicos — sem wildcards (`*`).

---

## Lambda (worker SQS)

**Função:** `prolink-abertura-worker`
**Runtime:** Node.js 20.x
**Região:** `us-east-1`
**Trigger:** SQS `prolink-abertura`

### IAM Execution Role

| Serviço | Ações |
|---|---|
| DynamoDB | `GetItem`, `UpdateItem` na tabela `fichas-abertura` |
| S3 | `GetObject`, `PutObject`, `CopyObject`, `DeleteObject` no bucket `prolink-fichas` |
| SNS | `Publish` no tópico `prolink-abertura-emails` |
| SQS | `ReceiveMessage`, `DeleteMessage`, `GetQueueAttributes` na fila `prolink-abertura` |

### Configuração (referência — detalhar no futuro)

| Parâmetro | Valor provisório |
|---|---|
| Timeout | 30s |
| Memória | 512MB |
| Concorrência | 1 (evita processamento duplicado) |
| DLQ | A definir |

### Estimativa de custo — 100 invocações/mês

100 invocações × 30s × 512MB = 1.536.000 GB-segundos
Free tier: 400.000 GB-segundos/mês → excedente: 1.136.000 × $0,0000166667 = **~$0,02/mês**

---

## Resumo de custo — 100 submissões/mês

| Serviço | Custo/mês |
|---|---|
| DynamoDB | < $0,01 |
| S3 | ~$0,02 |
| SQS | $0,00 (free tier) |
| SNS | $0,00 (free tier) |
| SES | ~$0,01 |
| Lambda | ~$0,02 |
| **AWS (total)** | **~$0,05** |
| Fargate (Next.js 24/7) | ~$8–12 (a calcular com sizing definitivo) |
| **Total geral** | **~$8–12/mês** |

> O Fargate domina o custo total. Os serviços gerenciados (DynamoDB, S3, SQS, SNS, SES, Lambda) somam centavos — escalam sem custo significativo até milhares de submissões/mês.
