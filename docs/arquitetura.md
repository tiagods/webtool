# Arquitetura — Prolink Contábil Web

## Escopo atual

| Formulário | Status |
|---|---|
| Ficha de Abertura de Empresa (Ltda e SLU) | ✅ Em desenvolvimento |
| Ficha de Alteração Contratual | ⏳ Pendente — próxima fase |

---

## Visão geral

> Desde a Spec 009 (ver [`009-separacao-frontend-backend.md`](../.claude/specs/009-separacao-frontend-backend.md)), frontend e backend são processos/containers separados. O Nginx é o ponto de entrada **recomendado**; a defesa contra acesso direto ao backend não vem da topologia do Docker Compose (todas as portas — 80, 3000, 3001 — são publicadas no host para facilitar debug local), e sim do **firewall do servidor em produção**, que libera 80 (e opcionalmente 3000) para a internet e bloqueia 3001 externamente.

```
[Internet]
   │
   ▼
[Firewall do servidor] ── libera 80 (e opcionalmente 3000); bloqueia 3001 ──
   │
   ▼
[Nginx :80] ── ponto de entrada recomendado ──────────────────────────────
   │
   ├─ "/"      ──→ [apps/web :3000]   (páginas, sem acesso a AWS)
   │
   └─ "/api/*" ──→ [apps/api :3001]   (porta publicada no host para debug
                        │              local; em produção, bloqueada pelo
                        │              firewall para tráfego externo)
                        ├─ Rascunho (a cada step) ──→ POST /api/draft ──→ DynamoDB (TTL 2h)
                        ├─ Upload de arquivo ────────→ POST /api/upload-url → S3 presigned URL → S3
                        └─ Envio final ─────────────→ POST /api/submit
                                                             │
                                                             ├─ Valida payload completo
                                                             ├─ Grava JSON de backup no S3
                                                             ├─ Atualiza status no DynamoDB → "enviado"
                                                             ├─ Gera número de protocolo
                                                             └─ Publica mensagem no SQS
                                                                         │
                                                                    [Lambda]
                                                                         ├─ Gera PDF da ficha (react-pdf)
                                                                         ├─ Faz upload do PDF para S3
                                                                         └─ Publica evento no SNS
                                                                                     │
                                                                               [SES subscription]
                                                                                     └─ Envia e-mail
                                                                                        (PDF + links S3)
```

---

## Camadas

| Camada | Pacote / App | Tecnologia | Responsabilidade |
|---|---|---|---|
| Borda / proxy | `infra/nginx` | Nginx | Único ponto de entrada público (porta 80); roteia por path para `web` ou `api` |
| Frontend | `apps/web` | Next.js 14+ (App Router) | Formulário multi-step, validação, upload — sem acesso a AWS |
| Backend / API | `apps/api` | Next.js 14+ (Route Handlers, sem UI) | Sessão, draft, presigned URL, submit, protocolo — **não exposto publicamente** |
| Worker | `apps/worker` | Lambda (Node.js/TS) | Gerar PDF e publicar evento no SNS |
| Shared | `packages/shared` | TypeScript + Zod | Schemas, tipos, constantes compartilhados |
| Sessão | — | JWT httpOnly cookie (2h) | Identificar sessão de preenchimento |
| Banco | — | DynamoDB | Rascunhos com TTL automático |
| Arquivos | — | S3 | Documentos dos sócios + JSON de backup |
| Fila | — | SQS | Desacoplar submit → Lambda |
| Notificação | — | SNS + SES subscription | Entregar e-mail ao cliente via SNS |
| Infraestrutura | — | Lightsail (Docker Compose: nginx + web + api) | Hospedar a stack completa |

> Detalhes da separação `web`/`api` e da topologia de rede Docker: [`009-separacao-frontend-backend.md`](../.claude/specs/009-separacao-frontend-backend.md).

---

## Sessão e persistência de rascunho

O formulário é público (sem login). A sessão serve exclusivamente para recuperar o rascunho em caso de refresh ou queda de conexão.

### Fluxo de sessão

```
1. Usuário abre /abertura pela primeira vez
2. Servidor cria sessionId (UUID v4), assina JWT com expiração de 2h
3. JWT enviado como cookie httpOnly — JS da página não consegue lê-lo
4. A cada avanço de step: POST /api/draft com o payload parcial
5. DynamoDB salva/atualiza o item com chave sessionId e TTL = agora + 2h
6. No reload: servidor lê o cookie → busca DynamoDB → devolve o rascunho
7. Após envio bem-sucedido: cookie é invalidado
```

### Por que httpOnly cookie e não localStorage

- Cookie httpOnly é invisível para JavaScript — protege contra XSS
- JWT carrega a expiração embutida (sem cron para limpar sessões)
- DynamoDB TTL remove automaticamente rascunhos expirados (sem custo de limpeza)

---

## DynamoDB — estrutura do item

```json
{
  "sessionId": "uuid-v4",
  "tipo": "ltda | slu",
  "status": "rascunho | enviado",
  "protocolo": "PRO-2025-000001",
  "createdAt": "ISO 8601",
  "updatedAt": "ISO 8601",
  "ttl": 1234567890,
  "payload": {
    "dadosEmpresa": { ... },
    "endereco": { ... },
    "socios": [ ... ],
    "documentos": {
      "socio_0_rg": "s3://bucket/sessao/socio_0_rg.pdf",
      "socio_0_cpf": "s3://bucket/sessao/socio_0_cpf.pdf"
    }
  }
}
```

> Os documentos não são armazenados no DynamoDB — apenas os links S3.

---

## S3 — organização de pastas

```
prolink-fichas/
  {sessionId}/
    documentos/
      socio_0_rg.pdf
      socio_0_cpf.pdf
      socio_1_rg.pdf
      ...
      imovel_iptu.pdf
    backup/
      ficha.json          ← payload completo no momento do envio
      ficha.pdf           ← PDF gerado pela Lambda
```

### Upload de arquivos (presigned URL)

O browser nunca envia arquivos para o servidor Next.js — vai direto para o S3:

```
1. Browser → POST /api/upload-url { campo: "socio_0_rg", contentType: "application/pdf" }
2. Servidor gera presigned PUT URL (validade: 5 min)
3. Browser faz PUT direto no S3 com o arquivo
4. Browser notifica /api/draft com o link do arquivo
```

---

## API Routes (`apps/api` — não exposto publicamente em produção)

Servidas por `apps/api` (Next.js Route Handlers), alcançáveis pelo browser através do Nginx (`/api/*`). O processo roda na porta `3001`, publicada no host (`ports: "3001:3001"`) para permitir debug local direto — em produção, o firewall do servidor bloqueia o acesso externo a essa porta, então nenhuma requisição de fora chega a `apps/api` sem passar pelo Nginx.

| Rota | Método | Descrição |
|---|---|---|
| `/api/aceite-termo` | POST | Registra aceite do Termo de Ciência, define cookie `prolink_aceite` |
| `/api/session` | POST | Cria sessionId, define cookie httpOnly `prolink_session` |
| `/api/session` | DELETE | Apaga sessão (DynamoDB + S3), exclusão sob solicitação (LGPD Art. 18) |
| `/api/draft` | GET | Restaura rascunho pelo cookie |
| `/api/draft` | POST | Salva/atualiza rascunho no DynamoDB |
| `/api/upload-url` | POST | Gera presigned URL para upload no S3 |
| `/api/submit` | POST | Valida, finaliza, publica no SQS |

---

## Fluxo de envio final

```
POST /api/submit
  │
  ├─ 1. Valida payload completo (Zod — schema do tipo ltda ou slu)
  ├─ 2. Gera protocolo: PRO-{ANO}-{sequencial com padding 6 dígitos}
  ├─ 3. Salva ficha.json no S3 (backup imutável)
  ├─ 4. Atualiza DynamoDB: status → "enviado", protocolo, submittedAt
  ├─ 5. Publica no SQS: { sessionId, protocolo, tipo }
  └─ 6. Retorna { protocolo } para o browser → redireciona para /abertura/confirmacao
```

### Lambda (worker SQS)

```
Evento SQS recebido: { sessionId, protocolo, tipo }
  │
  ├─ 1. Busca payload completo no DynamoDB
  ├─ 2. Gera PDF com react-pdf (Node.js)
  ├─ 3. Faz upload do PDF para S3: {sessionId}/backup/ficha.pdf
  ├─ 4. Publica evento no SNS (tópico: prolink-abertura-emails):
  │      { protocolo, nomeEmpresa, pdfUrl, documentosUrl[] }
  │           │
  │      [SES subscription]
  │           └─ Envia e-mail para contato@prolinkcontabil.com.br
  │              Assunto: [PRO-2026-000001] Nova ficha — {nomeEmpresa}
  │              Corpo: resumo dos dados + links dos documentos
  └─ 5. Atualiza DynamoDB: status → "em_analise"
```

---

## Estimativa de custo (100 formulários/mês)

| Serviço | Uso | Custo estimado |
|---|---|---|
| DynamoDB | ~1,5 MB storage, ~150k WRUs | Gratuito (free tier) |
| S3 | ~500 MB (docs + PDFs + JSONs) | ~$0,01 |
| SQS | 100 mensagens | Gratuito (free tier) |
| SNS | 100 publicações | Gratuito (free tier) |
| Lambda | 100 invocações, ~30s cada | ~$0,00 |
| SES | 100 e-mails (via SNS subscription) | ~$0,01 |
| Lightsail | Containers Nginx + Next.js (web) + Next.js (api) | $7–10/mês |
| **Total** | | **~$8–11/mês** |

---

## Topologia Docker Compose / Rede

```
docker-compose.yml (dev — com Floci)         docker-compose.prod.yml (produção — AWS real)
├── nginx    ports: "80:80"                  ├── nginx    ports: "80:80"
├── web      ports: "3000:3000"              ├── web      ports: "3000:3000"
├── api      ports: "3001:3001"              ├── api      ports: "3001:3001"
├── floci    ports: "4566:4566"              └── (sem floci/aws-init — credenciais AWS reais)
└── aws-init
```

Todos os serviços compartilham a mesma rede padrão do projeto Compose, então `nginx`, `web` e `api` se enxergam pelo nome do serviço (`http://web:3000`, `http://api:3001`). **As três portas (`80`, `3000`, `3001`) são publicadas no host em ambos os arquivos** — útil para debug local direto. A garantia de "backend não exposto" **não vem do Compose**, e sim do **firewall do servidor em produção**, que libera `80` (e opcionalmente `3000`) para a internet e bloqueia `3001` externamente. Isso é uma dependência operacional real do deploy — ver [`deploy.md`](../deploy.md). Ver [`009-separacao-frontend-backend.md`](../.claude/specs/009-separacao-frontend-backend.md) para o design completo.

---

## Segurança e LGPD

| Requisito | Implementação |
|---|---|
| Backend não exposto publicamente | `apps/api` publica a porta 3001 no host (debug local), mas em produção o **firewall do servidor** bloqueia acesso externo a ela — só tráfego local/Nginx alcança |
| Dados sensíveis em trânsito | HTTPS obrigatório (Lightsail + certificado) |
| Dados em repouso | S3 SSE + DynamoDB encryption (padrão AWS) |
| Acesso aos arquivos | S3 privado — acesso apenas via presigned URLs com validade curta |
| Sessão | JWT httpOnly, sem PII em URL |
| Consentimento LGPD | Banner de aceite antes do Passo 1 + checkbox no Passo 5 |
| Retenção | TTL 2h para rascunhos; 30 dias para itens enviados (backup real está no S3) |
| Direito de exclusão | `DELETE /api/session` apaga o item DynamoDB e os objetos S3 sob `{sessionId}/`, e invalida o cookie (ver [`011-exclusao-dados-lgpd.md`](../.claude/specs/011-exclusao-dados-lgpd.md)). Não se aplica a sessões já `enviado` — dados protocolados exigem processo manual |

---

## Estrutura do monorepo

```
webtool/                          ← raiz do monorepo
├── .claude/                      ← regras do agente
├── docs/                         ← documentação do projeto
├── fichas/                       ← Word originais (referência)
│
├── infra/
│   ├── local/                    ← provisionamento Floci (dev)
│   └── nginx/
│       └── default.conf          ← proxy: "/" → web, "/api/" → api
│
├── apps/
│   ├── web/                      ← Next.js 14+ (App Router) — só frontend, sem AWS
│   │   ├── app/
│   │   │   ├── abertura/
│   │   │   │   ├── page.tsx      ← formulário multi-step
│   │   │   │   └── confirmacao/
│   │   │   │       └── page.tsx  ← página de protocolo
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── forms/
│   │   │   │   ├── StepDadosEmpresa.tsx
│   │   │   │   ├── StepEndereco.tsx
│   │   │   │   ├── StepSocios.tsx
│   │   │   │   ├── StepSociedade.tsx   ← exclusivo Ltda
│   │   │   │   ├── StepDocumentos.tsx
│   │   │   │   └── StepRevisao.tsx
│   │   │   ├── ui/                     ← shadcn/ui
│   │   │   ├── Stepper.tsx
│   │   │   ├── UploadField.tsx
│   │   │   ├── RadioCard.tsx
│   │   │   └── RadioChip.tsx
│   │   ├── lib/
│   │   │   └── viacep.ts
│   │   ├── middleware.ts         ← só decide banner de aceite (lê cookie, não guarda API)
│   │   ├── package.json
│   │   ├── Dockerfile
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json         ← extends ../../tsconfig.base.json
│   │   └── next.config.mjs
│   │
│   ├── api/                      ← Next.js 14+ (Route Handlers, sem UI) — não exposto publicamente
│   │   ├── app/
│   │   │   └── api/
│   │   │       ├── aceite-termo/route.ts
│   │   │       ├── session/route.ts
│   │   │       ├── draft/route.ts
│   │   │       ├── upload-url/route.ts
│   │   │       └── submit/route.ts
│   │   ├── lib/
│   │   │   ├── auth.ts
│   │   │   ├── rateLimit.ts
│   │   │   └── aws/
│   │   │       ├── dynamodb.ts
│   │   │       ├── s3.ts
│   │   │       └── sqs.ts
│   │   ├── package.json
│   │   ├── Dockerfile
│   │   ├── tsconfig.json         ← extends ../../tsconfig.base.json
│   │   └── next.config.mjs
│   │
│   └── worker/                   ← Lambda SQS (Node.js/TS)
│       ├── src/
│       │   ├── handler.ts        ← entry point SQS
│       │   └── pdf/
│       │       └── FichaAbertura.tsx  ← template react-pdf
│       ├── package.json
│       └── tsconfig.json         ← extends ../../tsconfig.base.json
│
├── packages/
│   └── shared/                   ← @prolink/shared
│       ├── src/
│       │   ├── schemas/
│       │   │   ├── dadosEmpresa.ts
│       │   │   ├── endereco.ts
│       │   │   ├── socios.ts
│       │   │   └── sociedade.ts  ← schema exclusivo Ltda
│       │   ├── constants/
│       │   │   └── termo.ts      ← TERMO_VERSAO_ATUAL (usado por apps/web e apps/api)
│       │   ├── types/
│       │   │   └── index.ts
│       │   └── index.ts          ← barrel export
│       ├── package.json
│       └── tsconfig.json         ← extends ../../tsconfig.base.json
│
├── docker-compose.yml            ← serviços: nginx, web, api, floci, aws-init
├── package.json                  ← workspaces: ["apps/*", "packages/*"]
├── tsconfig.base.json            ← config TS compartilhada
└── README.md
```

> **npm workspaces**: `npm install` na raiz instala todas as dependências. Schemas Zod e constantes ficam em `@prolink/shared` e são importados por `apps/web`, `apps/api` e `apps/worker`.

---

## Dependências por pacote

### `apps/web` (Next.js — frontend)

```json
{
  "next": "^14",
  "react-hook-form": "^7",
  "@hookform/resolvers": "^3",
  "react-imask": "^7",
  "jose": "^5",
  "@prolink/shared": "*"
}
```

> `apps/web` mantém `jose` apenas para o `middleware.ts` verificar o cookie `prolink_aceite` (decidir se mostra o banner) — não faz mais nenhuma chamada AWS.

### `apps/api` (Next.js — backend, não exposto publicamente)

```json
{
  "next": "^14",
  "jose": "^5",
  "@aws-sdk/client-dynamodb": "^3",
  "@aws-sdk/lib-dynamodb": "^3",
  "@aws-sdk/client-s3": "^3",
  "@aws-sdk/s3-request-presigner": "^3",
  "@aws-sdk/client-sqs": "^3",
  "@prolink/shared": "*"
}
```

### `apps/worker` (Lambda)

```json
{
  "@aws-sdk/client-dynamodb": "^3",
  "@aws-sdk/lib-dynamodb": "^3",
  "@aws-sdk/client-s3": "^3",
  "@aws-sdk/client-ses": "^3",
  "@react-pdf/renderer": "^3",
  "@prolink/shared": "*"
}
```

### `packages/shared`

```json
{
  "zod": "^3"
}
```

> `jose` — biblioteca de JWT compatível com Edge Runtime do Next.js (sem dependências nativas).  
> `@prolink/shared` — link via npm workspaces, sem publicar no npm.
