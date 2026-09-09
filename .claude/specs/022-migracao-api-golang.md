---
id: "022"
title: "Migração de apps/api (Next.js) para Go — plano-guarda-chuva"
status: done           # draft | review | approved | in-progress | done | rejected
created: 2026-09-07
author: "tiagods"
batch_size: "medium"   # esta spec (scaffold); a migração completa é uma sequência de sub-specs
depends_on: []
---

# Migração de `apps/api` (Next.js) para Go — plano-guarda-chuva

## Contexto

`apps/api` hoje é um workspace Next.js 14 (App Router, só Route Handlers) com ~1.050 LOC de
TypeScript em 13 arquivos: 10 handlers em 8 `route.ts`, 3 clients AWS (`lib/aws/{dynamodb,s3,sqs}.ts`),
`lib/auth.ts` (JWT HS256 via `jose`, 2 cookies) e `lib/rateLimit.ts` (in-memory, usado só em
`/api/upload-url`). O acoplamento com Next.js é raso — só `NextResponse.json`, `cookies()` de
`next/headers` e roteamento por arquivo. Sem middleware, edge, SSR ou testes.

O usuário decidiu portar essa camada para **Go**, seguindo Clean Architecture e as boas
práticas de `.claude/rules/boas-praticas.md`. Já existe um esqueleto de diretórios vazio em
`apps/api-golang/` (`adapter/{web,event/consumer}`, `domain/{entity,ports,service}`,
`infrastructure/`). O módulo Go nasce como **monorepo** (`cmd/api` + `cmd/worker`),
preparado para hospedar também o worker da spec 013 no futuro, compartilhando
`infrastructure/aws`. A análise de viabilidade e esforço está em
`C:\Users\Tiago\.claude\plans\continue-ticklish-crystal.md` (resumo abaixo).

### Análise de viabilidade — resumo

**Veredito: viável. ~70% do port é tradução mecânica** (AWS SDK, JWT, cookies, handlers finos).
O custo real está concentrado em três frentes:

1. **Reimplementar a validação compartilhada** (~455–510 LOC de Zod em `@prolink/shared`),
   incluindo `superRefine` cross-field. `abertura` é moderado; **`alteracao` é o pedaço difícil**
   (união discriminada `cedente`/`cessionario` + validação condicional por quadro Q01–Q09).
2. **Construir a suíte de testes do zero** — hoje não há rede de segurança.
3. **Abrir mão do schema único** — hoje `@prolink/shared` serve web + api; depois teremos Zod
   (TS, cliente) e um validador Go (servidor) em paralelo, com risco de divergência.

**Ganhos concretos:** imagem ~15–25 MB (vs Node + `.next` standalone), memória ~15–30 MB
(vs ~80–120 MB), startup rápido, validação de env no boot idiomática, e a intenção da spec 019
(cadeia de credenciais padrão) sai "de graça". **ROI de custo AWS é fraco** (~US$ 0,03/mês); a
motivação real é densidade de container / preferência de stack — defensável.

**Riscos que a spec precisa mitigar:**
- `JWT_SECRET` está acoplado ao `apps/web/middleware.ts`, que faz `jwtVerify` do cookie
  `prolink_aceite` com o **mesmo segredo** (HS256). O token assinado em Go **tem** que ser
  validado pelo `jose` do web — claims, algoritmo e formato idênticos, ou o gate de LGPD
  quebra silenciosamente.
- Contrato web ↔ api tem que ficar **byte-a-byte idêntico** (paths, métodos, bodies, status,
  atributos de cookie, shape de erro).
- Specs 018 (config centralizada) e 019 (auth AWS centralizada) estão `draft` e mexem no mesmo
  código — o port Go **absorve a intenção das duas** e as torna obsoletas para `apps/api`.

## Objetivo

**Desta spec (022):** preparar o terreno — decisões de design transversais + o primeiro batch
(scaffold do módulo Go, `config` com validação no boot, Dockerfile, rota de health, wiring no
Compose ao lado do `apps/api` Node atual, sem removê-lo).

**Do conjunto de sub-specs (023–028):** reescrever todos os 10 handlers e as camadas de
suporte em Go, verificar o contrato contra o `apps/web` sem alteração, e fazer o cutover
(nginx + Compose apontando para o serviço Go; `apps/api` Node removido só depois de verificado).

## Fora de escopo

- **Implementação do `cmd/worker` / spec 013** (PDF + e-mail) — o módulo Go já nasce como
  monorepo `cmd/api` + `cmd/worker` e o `cmd/worker/main.go` fica um **stub compilável**;
  toda a lógica do worker (loop SQS, PDF, SNS) pertence à spec 013.
- **Qualquer mudança em `apps/web`** — o front continua chamando `/api/*` relativo e mantém a
  cópia TS dos schemas Zod no cliente (`zodResolver`). Nenhum arquivo de `apps/web` muda.
- **`@prolink/shared`** — o pacote continua existindo e servindo o `apps/web`. O Go **não**
  consome esse pacote; reimplementa as regras.
- **Spec 021** (IAM roles + Fargate taskdefs) — coordenar, não executar aqui.
- **Layout/geração de PDF** — pertence à spec 013.
- **Mudança de comportamento** — zero. Se algo parece um bug no `apps/api` atual, corrige-se
  no Node primeiro (spec própria), não "de brinde" no port.
- **TLS/Caddy, firewall do servidor** — inalterados (`docker-compose.prod.yml` já cobre).

## Design

### Stack de bibliotecas Go

| Necessidade | Escolha | Justificativa |
|---|---|---|
| Roteamento HTTP | `github.com/labstack/echo/v4` | Escolha do usuário. Grupos de rota (`/api`, `/api/alteracao`), middleware ergonômico (rate limit, guard de sessão), binding/erro centralizado. |
| Toolchain | Go **1.27** | `go.mod` declara `go 1.27` (toolchain local = 1.27.1; satisfaz o "1.26+" pedido pelo usuário e evita download de toolchain sob demanda). |
| AWS | `aws-sdk-go-v2` (`config`, `service/dynamodb`, `feature/dynamodb/expression`, `service/dynamodb/attributevalue`, `service/s3`, `service/s3` presign, `service/sqs`) | SDK oficial v2, cadeia de credenciais padrão. Entra na spec 023. |
| JWT | `github.com/golang-jwt/jwt/v5` | HS256, compatível com `jose` do web. Entra na spec 024. |
| Validação | `github.com/go-playground/validator/v10` + funções cross-field escritas à mão | Field-level via struct tags; regras condicionais como funções nomeadas testáveis. Entra nas specs 025/027. |
| UUID | `github.com/google/uuid` | Equivalente a `crypto.randomUUID()`. Entra na spec 024. |
| Config | stdlib (`os.LookupEnv` via seam `Lookup`) + validação explícita no boot | Idiomático; nada de framework de config. `Load(Lookup)` testável sem estado global. |
| Lint | `go vet` + `gofmt -l` no batch 022; `golangci-lint` entra na spec 023 | Evita introduzir tooling + `.golangci.yml` + passo de CI já no scaffold. |

Tudo o que não estiver nessa lista precisa de justificativa na sub-spec que introduzir a dep.

### Estrutura de diretórios (Clean Architecture)

Mantém o esqueleto já criado pelo usuário em `apps/api-golang/`, adicionando `cmd/` e `go.mod`:

```
apps/api-golang/
  go.mod                        # module github.com/tiagods/webtool/apps/api-golang · go 1.27
  cmd/
    api/main.go                 # ~3 linhas: chama infrastructure.StartApp()
    worker/main.go              # [spec 013, stub por agora] consumidor SQS — reusa infrastructure/aws
  domain/
    entity/                     # Rascunho, RegistroAceite, AberturaForm, AlteracaoForm, Protocolo
    ports/                      # interfaces (definidas aqui, o consumidor é o service):
                                #   DraftRepository, ObjectStorage, EventPublisher,
                                #   TokenSigner/TokenVerifier, RateLimiter, ProtocoloCounter
    service/                    # casos de uso — regras, orquestração, SEM I/O direto:
                                #   SessionService, AceiteService, DraftService, SubmitService
  adapter/
    web/                        # handlers Echo, router, middlewares (requestContext,
                                #   httpErrorHandler), DTOs. Depende de domain/service + ports.
    event/
      consumer/                 # [spec 013] handler de mensagem SQS (processMessage puro + DI)
  infrastructure/
    controller.go               # StartApp() — ÚNICO ponto de composição: config → adapters →
                                #   services → router → signal.NotifyContext + shutdown gracioso
    aws/                        # config.go (cadeia de credenciais + endpoint override),
                                #   dynamodb.go, s3.go, sqs.go — implementam ports (compartilhado api+worker)
    auth/                       # jwt.go — implementa TokenSigner/TokenVerifier
    ratelimit/                  # memory.go — implementa RateLimiter
    config/                     # config.go — struct Config + Load() com validação no boot
    httperrors/                 # HTTPError{Status,Message,Err} + atalhos (BadRequest, Conflict…)
    logger/                     # fachada slog.Default() + cid do requestcontext
    requestcontext/             # RequestContext{CID,Tenant,Roles} no context.Context (pacote puro)
```

Regra de dependência:

```
cmd/api, cmd/worker ─→ infrastructure.StartApp()
infrastructure.StartApp() ─→ (config, adapter/web, adapters — ÚNICO ponto que importa adapter/)
adapter/web ─→ domain/service ─→ domain/ports ←─ infrastructure/{aws,auth,ratelimit}
adapter/web ─→ domain/entity ←─ domain/service
```

`domain/` **não importa** `adapter/`, `infrastructure/`, `aws-sdk-go-v2` nem `echo`. Ports
usam só tipos de `domain/entity` e stdlib (`context.Context`). O Echo fica confinado a
`adapter/web`. `infrastructure/{aws,auth,ratelimit,config,httperrors,logger,requestcontext}`
**não** importam `adapter/` — só o `infrastructure/controller.go` (`StartApp`) faz o wiring.

### Convenções Go obrigatórias (boas práticas + idiomático)

- `context.Context` como **primeiro parâmetro** de toda função que faz I/O.
- Erros embrulhados com `fmt.Errorf("...: %w", err)`; erros de domínio como valores
  (`var ErrSessaoInvalida = errors.New(...)`) para o `adapter/web` mapear a status HTTP.
- Interfaces **pequenas**, declaradas no pacote que as consome (`domain/ports`), não no que
  as implementa. "Accept interfaces, return structs".
- **Zero estado global** — nada de `init()` com client AWS, nada de singleton de package.
  Tudo injetado via construtor (`NewDynamoDraftRepository(client, tableName)`).
- Structs de config e de request agrupam parâmetros relacionados (evitar >4 params soltos).
- Nomes do domínio em português quando já são termos do negócio (`Rascunho`, `Protocolo`,
  `TipoConstituicao`), resto em inglês idiomático Go.
- `go vet` e `gofmt -l` limpos; `go test ./...` verde. (`golangci-lint` a partir da spec 023.)
- `os.LookupEnv`/`os.Getenv` proibido fora de `infrastructure/config`.

### Contrato a preservar (levantado do código atual)

Todos os 10 handlers, com **paths, métodos, request bodies, response bodies e status
idênticos**. Resumo:

| Rota | Métodos | Notas de contrato que o Go tem que replicar |
|---|---|---|
| `/api/aceite-termo` | POST | valida `{versaoTermo}` == `TERMO_VERSAO_ATUAL`; grava `RegistroAceite` no DynamoDB (TTL 5 anos); assina cookie `prolink_aceite` (JWT `{sub, versaoTermo}`, maxAge 1 ano, httpOnly, SameSite=Lax, Secure em prod, Path=/); resp `{ok:true}` / `{error}` 400/500 |
| `/api/session` | POST, DELETE | POST: `requireAceite` → `createOrGetSession` (JWT `{sub}`, expira em `SESSION_EXPIRY_SECONDS`) + `ensureRascunhoInicial` (UpdateItem `if_not_exists`, TTL 2h); só seta cookie se `isNew`. DELETE (LGPD Art. 18): 403 se sessão inexistente, **409** se `status=='enviado'`, senão apaga objetos S3 `{sessionId}/` + item DynamoDB, expira cookie |
| `/api/draft` | GET, POST | guard = `requireAceite` + `requireSession` (tabela Abertura). POST tem **2 variantes**: `{uploadedCampo, contentType}` (valida `^[a-z0-9_]{1,80}$` + content-type permitido, grava `documentosKeys.<campo>` via UpdateItem) ou payload de formulário (`aberturaFormDraftSchema`, `putRascunho`). GET devolve `{payload, documentosKeys}` |
| `/api/upload-url` | POST | **rate limit por IP** (`x-forwarded-for`, 20 req / 60s, in-memory) → 429; `requireAceite`; valida `{campo, contentType}`; `createOrGetSession`; gera presigned PUT (expira 300s, `Tagging: retention=rascunho`); resp `{url}` (a key **não** volta ao cliente) |
| `/api/submit` | POST | `requireAceite` + `requireSession`; valida `aberturaFormSchema` (com cross-field); `proximoProtocolo('PRO-', ...)` (contador atômico `ADD seq`); copia `documentosKeys` de `{sessionId}/documentos/` para `protocolos/{protocolo}/` (`errgroup`); `publishSubmissao` SQS; `marcarEnviado` (zera payload/keys, TTL 30d); apaga `{sessionId}/`; resp `{protocolo}`, expira cookie |
| `/api/alteracao/session` | POST | igual a `/api/session` POST mas com `getAlteracaoTableName()`; `ensureRascunhoInicial` extra se `!isNew` |
| `/api/alteracao/draft` | GET, POST | guard com tabela Alteração; POST valida `alteracaoFormDraftSchema`; GET `{payload}` |
| `/api/alteracao/submit` | POST | valida `alteracaoFormSchema`; `proximoProtocolo('ALT-', ...)`; `putJsonObject('protocolos/{protocolo}/alteracao.json', payload)` (sem cópia de arquivos); SQS; `marcarEnviado`; resp `{protocolo}`, expira cookie |

Detalhes de infra AWS a portar fielmente:
- **DynamoDB**: `UpdateExpression` com `if_not_exists` (bootstrap idempotente); contador
  atômico `ADD seq` com `ReturnValues: UPDATED_NEW`; escrita de `payload = null` +
  `documentosKeys = null` no mesmo UpdateItem que `status = 'enviado'`; TTLs 2h / 30d / 5 anos.
- **S3**: presigned PUT com `ContentType` + `Tagging`; `CopyObject` com
  `TaggingDirective: REPLACE` + `Tagging: ""` (remove a tag de retenção); `ListObjectsV2` +
  `DeleteObjects` por prefixo (assume < 1000 objetos).
- **SQS**: `SendMessage` com `MessageBody` = JSON `{sessionId, protocolo, formType, tipo?}`.
- **Endpoint override**: quando `AWS_ENDPOINT_URL` está setado (Floci), usar `BaseEndpoint`
  + `UsePathStyle: true` no S3 + credenciais estáticas `test`/`test`; ausente → cadeia padrão.

### Config (`infrastructure/config`)

Struct única `Config` (com `AWS` aninhada), `Load(Lookup) (Config, error)` chamada no `main.go`
via `LoadFromEnv()`. **Falha o boot** com erro agregado (`errors.Join`) listando **toda**
variável obrigatória ausente/inválida — nunca retorna `Config` parcial. Seam de teste:
`type Lookup func(string) (string, bool)`.

**Sem valor chumbado no código** (`.claude/rules/boas-praticas.md` §9) — não há fallback
literal para `JWT_SECRET` (ao contrário do Node, que cai em `'dev-secret-change-in-production'`).

| Variável | Obrigatória? | Default | Nota |
|---|---|---|---|
| `APP_ENV` | **sim** (enum `dev\|prod`) | — | decide `Secure` no cookie; ausente = boot falha |
| `JWT_SECRET` | **sim** | — | compartilhada com o `jose` do `apps/web` |
| `AWS_REGION` | **sim** | — | |
| `AWS_DYNAMODB_TABLE` | **sim** | — | `fichas-abertura` |
| `AWS_DYNAMODB_ALTERACAO_TABLE` | **sim** | — | `fichas-alteracao` |
| `AWS_DYNAMODB_ACEITES_TABLE` | **sim** | — | hoje só fallback literal no Node — o port a torna env explícita e a adiciona ao Compose |
| `AWS_S3_BUCKET` | **sim** | — | `prolink-fichas` |
| `AWS_SQS_QUEUE_URL` | **sim** | — | |
| `PORT` | não | `3001` | |
| `SESSION_EXPIRY_SECONDS` | não | `7200` | |
| `SHUTDOWN_TIMEOUT_SECONDS` | não | `10` | grace period do `e.Shutdown` — não chumbar |
| `AWS_ENDPOINT_URL` | não | `""` | vazio → cadeia de credenciais padrão (prod) |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | só se `AWS_ENDPOINT_URL` setada | — | Floci: `test`/`test` |

**Dev local sem Docker:** com o Go exigindo `JWT_SECRET`, é preciso exportar a variável (ou
copiar `.env.example` → `.env`). O `docker-compose.yml` dev já injeta
`${JWT_SECRET:-dev-secret-change-in-production}`, então o fluxo Docker continua funcionando.
`apps/web` mantém seu fallback literal por ora (dropá-lo é follow-up da spec 028).

### Sequência de sub-specs (small batches — cada uma ≤ ~1 dia útil, `depends_on` encadeado)

| Spec | Escopo | Estim. |
|---|---|---|
| **022** (esta) | `go.mod` (go 1.27), `infrastructure.StartApp()` + `cmd/{api,worker}/main.go`, `infrastructure/config`, `infrastructure/{httperrors,logger,requestcontext}` + middlewares em `adapter/web`, Dockerfile multi-stage alpine (`ARG APP`), rota `GET /health`, serviço `api-go` no `docker-compose.yml` (`3002:3001`) sem tocar no `api` Node, `.claude/rules/boas-praticas-go.md`, `.env.example`, seção Go do `.gitignore` | 0,5–1 d |
| [**023**](023-go-camada-aws.md) | Camada AWS: ports + `infrastructure/aws/{config,dynamodb,s3,sqs}.go` + testes contra Floci; `golangci-lint` | 2 d |
| [**024**](024-go-auth-e-sessao.md) | Auth: `infrastructure/auth/jwt.go` (HS256), helpers de cookie, `ratelimit/memory.go`, `SessionService`/`AceiteService`, rotas `POST /api/aceite-termo`, `POST+DELETE /api/session`, `POST /api/alteracao/session`. **Cross-verificação com `apps/web/middleware.ts`** | 1,5 d |
| [**025**](025-go-validacao-abertura-e-draft.md) | Validação `abertura` (field-level + `superRefine`) + semântica `strict+partial` dos drafts + `DraftService` + `GET/POST /api/draft` (2 variantes) + `POST /api/upload-url` + pré-tarefa de caracterização | 3 d |
| [**026**](026-go-submit-abertura.md) | `SubmitService` + `POST /api/submit` (cópia S3 com `errgroup`, protocolo, `marcarEnviado`, limpeza) | 1,5 d |
| [**027**](027-go-validacao-e-rotas-alteracao.md) | Validação `alteracao` (união discriminada + condicional por quadro) + `GET/POST /api/alteracao/draft` + `POST /api/alteracao/submit` | 3–4 d |
| [**028**](028-go-verificacao-e-cutover.md) | Verificação de contrato E2E (web sem alteração via nginx + Floci: abertura Ltda/SLU, alteração, DELETE LGPD, rate limit, JWT↔middleware); **cutover** (`apps/api` Node → `apps/api-node`; `apps/api-golang` → `apps/api`; nginx/Compose apontando para o serviço Go na porta canônica 3001; deleção de `apps/api-node` após verificado); atualização de `docs/`, `CLAUDE.md`, `README.md`, `deploy.md`; specs 018/019 → `rejected` | 2 d |

Total realista: **~15–18 dias úteis** (bate com a análise: 15–20 d).

## Critérios de aceite (desta spec — 022)

- [x] `apps/api-golang/go.mod` criado (`module github.com/tiagods/webtool/apps/api-golang`, `go 1.27`), `go.sum` commitado, única dep direta = `labstack/echo/v4` (v4.15.4)
- [x] `infrastructure/config/config.go` com `Config` + `Load(Lookup)` que falha o boot (erro agregado) sem qualquer obrigatória (`APP_ENV`, `JWT_SECRET`, `AWS_REGION`, 3 tabelas, bucket, fila); `config_test.go` table-driven cobrindo obrigatórias/defaults/condicionais — `go test -race` verde
- [x] `infrastructure.StartApp()` (chamado por `cmd/api/main.go` enxuto) sobe um servidor Echo na `PORT`, com `GET /health` → `200 {"status":"ok"}` e shutdown gracioso em SIGTERM/SIGINT (`echo.Shutdown` + `signal.NotifyContext`), sem `log.Fatal`/`os.Exit` fora de `main` — verificado local **e via Docker**: `docker compose kill -s SIGTERM api-go` → exit 0, sem panic
- [x] `infrastructure.StartWorker()` stub (chamado por `cmd/worker/main.go` enxuto) loga "worker não implementado — spec 013" e sai 0 — verificado
- [x] `infrastructure/{httperrors,logger,requestcontext}` + middlewares `requestContext`/`httpErrorHandler` em `adapter/web` (a causa interna do erro nunca vai no corpo, só no log) — `middleware_test.go` cobre o mapeamento erro→status
- [x] `.gitattributes` na raiz força LF em `*.go`/`*.ts`/etc. (após um arquivo Go ter chegado com CRLF de um editor Windows)
- [x] `apps/api-golang/Dockerfile` multi-stage (`golang:1.27-alpine` → `alpine:3.20`), binário estático `CGO_ENABLED=0` não-root (uid 10001), `ARG APP` (api|worker), builder roda `go vet`; `.dockerignore` criado — **imagem api 15,8 MB / worker 13,3 MB** (< 30 MB; vs 157 MB do `webtool-api` Node)
- [x] Serviço `api-go` no `docker-compose.yml` (`ports: "3002:3001"`, `APP_ENV: dev`, mesmas env AWS do `api` + `AWS_DYNAMODB_ACEITES_TABLE`, `depends_on: floci`, healthcheck `wget`), **sem remover nem alterar** o serviço `api` Node — `docker compose up -d --build api-go` → container `healthy`
- [x] `Makefile` em `apps/api-golang/` (`build`/`vet`/`fmt-check`/`lint`/`test`/`tidy`); `go vet` + `gofmt -l` (vazio) + `go test` verdes
- [x] `docker compose up -d --build api-go` sobe e `curl localhost:3002/health` responde `{"status":"ok"}` (com header `X-Cid`)
- [x] `.env.example` na raiz + nota no `README.md` sobre `JWT_SECRET` obrigatória; seção `# Go` no `.gitignore`
- [x] `.claude/rules/boas-praticas-go.md` criado, fixando as convenções Go
- [x] `.claude/tasks/todo.md` sincronizado; sub-specs 023–028 criadas como `draft` com `depends_on` encadeado

## Notas

- **Decisões do usuário (2026-09-07):** (a) módulo Go nasce como monorepo `cmd/api` +
  `cmd/worker` (worker fica stub nesta spec, implementado na 013); (b) no cutover (spec 028)
  `apps/api-golang` é renomeado para `apps/api` e o Node vira `apps/api-node` temporário até
  ser deletado; (c) roteador = Echo v4; (d) toolchain Go 1.27 (local instalado; "1.26+"
  pedido); (e) imagem base alpine; (f) `cmd/api` na porta interna canônica 3001, `cmd/worker`
  na 3002; (g) `JWT_SECRET` e toda config por env var, boot falha rápido, zero fallback no
  código; (h) `APP_ENV` enum obrigatório sem default; (i) testes depois da implementação
  (exceto `config_test.go`).
- **Ambiente:** Go 1.27.1 instalado em `C:\Program Files\Go`, mas há um `GOROOT=C:\Go`
  obsoleto no ambiente que quebra o comando `go` — precisa ser removido/corrigido pelo usuário
  (ou sobrescrito por chamada). `go` também não está no PATH do shell.
- Esta spec **não** implementa handler nenhum — só scaffold. Handlers vêm nas sub-specs.
- O `apps/api` Node fica de pé e servindo produção durante toda a migração; o cutover (spec
  028) só acontece depois da verificação de contrato completa.
- A cópia TS dos schemas em `apps/web` (via `@prolink/shared`) **permanece** — o web valida no
  cliente com Zod, o Go revalida no servidor. Divergência entre os dois é o principal risco
  arquitetural; mitigar com testes de caracterização (mesmos payloads, mesmo veredito) na
  spec 025/027.
- Specs 018 e 019 devem ser marcadas `rejected`/`superseded` para `apps/api` quando 028
  fechar (a config centralizada e a auth AWS única passam a existir nativamente no Go).

## Questões resolvidas

1. **`JWT_SECRET` default de dev** → **resolvido**: sem fallback no código; sempre obrigatória
   por env. `.env.example` + nota no README cobrem o dev local.
2. **Porta canônica** → **resolvido**: `cmd/api` escuta sempre na 3001 (canônica). Durante a
   migração o `docker-compose.yml` publica `3002:3001`; no cutover (028) vira `3001:3001` e o
   `infra/nginx/default.conf` (`proxy_pass http://api:3001`) não muda.
3. **Testes de caracterização** → **resolvido**: passam a ser **pré-tarefa da spec 025** (não
   do 022). Gravar veredito esperado por payload rodando contra o `apps/api` Node antes de
   portar a validação.
