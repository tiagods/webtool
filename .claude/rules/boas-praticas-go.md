# Boas práticas de código Go — `apps/backend`

Complemento de [`boas-praticas.md`](./boas-praticas.md) para o código Go do monorepo
`apps/backend` (spec 022+). Quando houver conflito entre uma preferência geral e um idioma
Go consagrado, **este arquivo tem precedência**.

Base: [Effective Go](https://go.dev/doc/effective_go), [Go Code Review Comments](https://go.dev/wiki/CodeReviewComments),
os 10 mandamentos de `boas-praticas.md` e a Clean Architecture do `.claude/CLAUDE.md`.

---

## 1. Layout de pacotes e regra de dependência

```
cmd/api, cmd/worker  →  chamam o entrypoint de composição (main enxuto)
infrastructure       →  StartApp() — ÚNICO ponto de composição: importa config,
                        adapter/web, adapters e faz o wiring + ciclo de vida
adapter/web          →  adapter/web/handler, infrastructure/middleware      (SÓ o router.go:
                        Deps + NewRouter — liga rota → handler)
adapter/web/handler  →  domain/service, domain/ports, domain/entity,
                        adapter/web/presenter, infra/{middleware,auth,httperrors}  (handlers Echo)
adapter/web/presenter→  domain/entity, domain/validation                   (contratos JSON da API;
                        só o handler usa; presenter ⇆ entity)
infra/middleware     →  domain/service, domain/ports, domain/entity, echo (middlewares Echo:
                        RequestContext, HTTPErrorHandler, RateLimit, GuardAceite, GuardSessao)
adapter/event/*      →  domain/service, domain/ports, domain/entity
infrastructure/*     →  domain/ports/outbound, domain/entity              (implementam os ports)
infra/aws/model      →  domain/entity                                    (projeções `dynamodbav`;
                        só o repositório usa; model → entity)
domain/service       →  domain/ports, domain/entity                       (implementa ports/inbound)
domain/ports/inbound →  domain/entity + stdlib (context)                  APENAS
domain/ports/outbound→  domain/entity + stdlib (context)                  APENAS
domain/entity        →  stdlib APENAS
```

- **Ponto de composição:** `infrastructure.StartApp()` (chamado por um `cmd/*/main.go`
  enxuto de ~3 linhas). É o **único** lugar em `infrastructure` autorizado a importar
  `adapter/` — os demais pacotes de `infrastructure/*` só implementam ports e não conhecem
  `adapter/`. `StartApp` lê a config, monta os adapters, injeta nos services, monta o router
  e cuida do `signal.NotifyContext` + shutdown gracioso.
- `domain/` **nunca** importa `adapter/`, `infrastructure/`, `github.com/labstack/echo/v4`,
  `github.com/aws/aws-sdk-go-v2/...` ou qualquer SDK. Se um tipo de domínio precisa de algo
  externo, isso vira um **port** (interface) que a `infrastructure` implementa.
- Handlers (`adapter/web/handler`) recebem `echo.Context`, extraem/validam o request, chamam
  um `service` com tipos de domínio, e traduzem o resultado/erro em resposta HTTP.
  **Sem regra de negócio no handler.** Os métodos exportados (`h.PostSubmit`, …) e `Health`
  são a superfície que o `router.go` consome; helpers (`valorOuPadrao`) ficam não-exportados.
- **Contratos da API em `adapter/web/presenter`** (structs de request/response com tags
  `json`): só o `handler` os importa. Um presenter é construído a partir do domínio
  (`presenter.DraftFromRascunho(*entity.Rascunho)`, `NewSubmit(protocolo)`, …) e serializado
  de volta — nunca carrega regra de negócio, nunca vaza para o `service` ou para um port.
- **Projeções de persistência em `infra/aws/model`** (structs `dynamodbav`): só o repositório
  as importa. O port recebe/devolve **entity**; na leitura o repo decodifica para um
  `model.*Item` e chama `.ToEntity()` **antes de retornar**. Na escrita, montar o item inline
  ou via `model.XxxFromEntity(...)` — não há necessidade de o port receber um model.
- **`adapter/web` = só `router.go`** (`Deps` + `NewRouter`): registra middlewares base e liga
  cada rota a um `handler.*`. Os testes de integração HTTP ficam em `package web_test` no
  mesmo diretório (caixa-preta via `web.NewRouter` + `httptest`).
- Um `service` não conhece HTTP, status codes, cookies, nem o AWS SDK.
- **Middlewares Echo vivem em `infrastructure/middleware`** (não em `adapter/web`): correlation
  id (`RequestContext`), tradução erro→JSON (`HTTPErrorHandler` + `statusDeDominio`),
  rate limit (`RateLimit`) e os guards (`GuardAceite`/`GuardSessao`, chave
  `ContextSessionID`, helper `LerCookie`). `adapter/web` importa esse pacote e o usa em
  `NewRouter`; o `middleware` do Echo entra alias `echomw` para não colidir. `adapter/web`
  segue sendo o único a definir *handlers* Echo.

## 2. Os 10 mandamentos → idiomas Go

| # | Mandamento | Em Go |
|---|---|---|
| 1 | Legibilidade | `gofmt` sempre; nomes que contam a história; sem `x`, `tmp`, `data` genéricos |
| 2 | Sem nomes misteriosos | `MixedCaps`; sem `snake_case`; siglas em caixa uniforme (`ID`, `URL`, `HTTP`) |
| 3 | Funções curtas | < 20 linhas, < 3 níveis de indentação; early return; extrair helper nomeado |
| 4 | DRY | extrair, mas sem abstração prematura; um helper só existe se o nome agrega clareza |
| 5 | Testes | table-driven, `t.Parallel()` quando seguro, `-race` no CI (escritos **depois** da implementação, salvo `config_test.go`) |
| 6 | Comentar o porquê | doc-comment começa com o nome do identificador; comentário registra decisão/restrição, não repete o código |
| 7 | Erros previsíveis | ver §4; nunca engolir `err`; nunca `panic` em fluxo normal |
| 8 | Complexidade | ≤ 5 parâmetros — agrupar em struct (`Deps`, `Config`, `XxxParams`); sem condicional aninhada profunda |
| 9 | Consistência / sem valor chumbado | toda config vem de `infrastructure/config.Config` injetada; magic values viram constantes nomeadas |
| 10 | Documentar o essencial | doc-comment em todo identificador exportado; `README`/spec atualizados |

## 3. Formatação e nomes

- `gofmt` (via `make fmt`) é inegociável — `make fmt-check` falha o batch se algo estiver fora.
- Pacotes: nome curto, minúsculo, sem `_`, sem plural (`config`, `web`, `auth`, não `configs`).
- Sem `util`/`common`/`helpers` como nome de pacote.
- Nomes de negócio em **pt-BR** quando já são termos do domínio: `Rascunho`, `Protocolo`,
  `TipoConstituicao`, `RegistroAceite`. O resto em inglês idiomático (`repository`, `publish`,
  `shutdown`).

## 4. Erros

- Embrulhar com contexto: `fmt.Errorf("carregar configuração: %w", err)`.
- String de erro: minúscula, sem pontuação final, sem "failed to".
- Erros de domínio como **valores sentinela** no pacote `domain` para o `adapter/web` mapear
  para status HTTP:
  ```go
  var (
      ErrSessaoInvalida = errors.New("sessão inválida ou expirada")
      ErrSessaoEnviada  = errors.New("sessão já enviada")
  )
  ```
- `errors.Is` / `errors.As` só nas fronteiras (handler, `main`). No meio, propagar com `%w`.
- Agregar múltiplos erros de validação com `errors.Join`.

## 5. Interfaces, ports e injeção de dependências

- Interface **declarada pelo consumidor** (`domain/ports`), não pelo implementador.
- **Ports organizados por entidade, não por tipo de operação.** Um port agrupa todas as
  operações de uma entidade do domínio (ex.: `RascunhoRepository` = buscar + criar + editar +
  marcar enviado + apagar). **Não** dividir em `Reader`/`Writer` só para caber num limite de
  métodos — a coesão por entidade vem primeiro.
- **`domain/ports/inbound/`** — o que é chamado de dentro para fora (casos de uso / serviços
  invocados pelos handlers). **`domain/ports/outbound/`** — o que chama sistemas externos
  (repositórios, storage, publishers) implementado pela `infrastructure`.
- "Accept interfaces, return structs." Manter o método enxuto e a assinatura em tipos de
  domínio + `context.Context`.
- Construtor explícito para tudo: `NewDynamoDraftRepository(client *dynamodb.Client, table string) *DynamoDraftRepository`.
- **Zero estado global:** proibido `var` de pacote com client/config/logger; proibido `init()`
  com efeito colateral (abrir conexão, ler env). Tudo flui de `infrastructure.StartApp()` para
  baixo. (Exceção sancionada: a fachada `infrastructure/logger` sobre `slog.Default()`,
  configurado uma vez no `StartApp`.)

## 6. `context.Context`

- **Primeiro parâmetro** de toda função que faz I/O ou pode ser cancelada.
- Nunca guardar `Context` em struct; sempre passar adiante.
- Respeitar cancelamento (`ctx.Err()`, `<-ctx.Done()`).
- Em `main`: `signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)`.

## 7. Configuração

- `os.Getenv` / `os.LookupEnv` **proibido fora de `infrastructure/config`**.
- `Load(lookup Lookup) (Config, error)` — `Lookup` é o seam de teste (`func(string)(string,bool)`).
- Boot falha rápido com erro **agregado** listando toda variável faltante — nunca `Config`
  parcial, nunca default silencioso para o que é obrigatório.

## 8. Camada HTTP (`adapter/web/handler` + `adapter/web` + `infrastructure/middleware`)

- Handler fino (`adapter/web/handler`): `bind → validate → service → mapear erro → status`.
- Um único `middleware.HTTPErrorHandler` (`e.HTTPErrorHandler`) traduz erro → status + corpo
  `{"error": "..."}`. Reconhece `*httperrors.HTTPError` e `*echo.HTTPError`; a causa interna
  (`Err`) **nunca** vai no corpo, só no log.
- `httperrors.HTTPError{Status, Message, Err}` é o erro de transporte; atalhos
  `BadRequest/Forbidden/Conflict/TooManyRequests/Internal`.
- Requests e respostas via struct tipada de `adapter/web/presenter` (tags `json`), nunca
  `map[string]any` ad-hoc nem struct declarada no arquivo do handler.
- Router base (`adapter/web/router.go` — `NewRouter`): `echomw.Recover()` +
  `middleware.RequestContext` (gera/propaga o `cid` via header `X-Cid` e o coloca no
  `context.Context`). O `middleware` do Echo entra alias `echomw` (colisão com o nosso).
- Middlewares em `infrastructure/middleware` (§1): `RequestContext`, `HTTPErrorHandler`,
  `RateLimit`, `GuardAceite`, `GuardSessao` (chave `ContextSessionID`, helper `LerCookie`).

## 9. Concorrência

- Fan-out com `golang.org/x/sync/errgroup` (ex.: cópia de N objetos S3 no submit).
- Toda goroutine tem dono e ciclo de vida claro; nada de goroutine órfã.
- Sempre respeitar `ctx` dentro da goroutine.

## 10. Logging

- `log/slog` estruturado (JSON), saída em `stderr`, sem segredos/PII.
- Fachada `infrastructure/logger` com funções `Warn(ctx, err, msg)` / `Error(ctx, err, msg)`
  sobre `slog.Default()`, que anexam o `cid` do `requestcontext`. O handler é configurado uma
  única vez no `StartApp` (`slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stderr, nil)))`).
- Serviços e handlers logam via a fachada; não recebem `*slog.Logger` como parâmetro.

## 11. Dependências

- Só as da tabela "Stack de bibliotecas Go" da spec 022 + as introduzidas por sub-spec
  aprovada. Preferir stdlib. Já em uso: `echo/v4`, `google/uuid`, `aws-sdk-go-v2` (core +
  `config`/`credentials`/`service/{dynamodb,s3,sqs}`/`feature/dynamodb/{attributevalue,expression}`,
  spec 023), `golang-jwt/jwt/v5` (spec 024 — assinatura/verificação HS256, confinada a
  `infrastructure/auth`; interoperável com o `jose` do `apps/web`).
- Nova dependência exige justificativa na sub-spec que a introduz + entrada no `go.mod` com
  versão fixada.
- `go mod tidy` limpo (`git diff --exit-code go.mod go.sum` após `make tidy`).
- `go.uber.org/mock` (mockgen) — geração de mocks dos ports; entra via diretiva `tool`
  no `go.mod`. Ver §12.
- AWS SDK: um tipo do SDK **nunca** cruza a fronteira de um port. O repositório traduz
  entity ⇆ `infra/aws/model.*Item` (`dynamodbav`) internamente (ver §1/§8). O pacote
  `github.com/aws/aws-sdk-go-v2/aws` é importado como `awssdk` (o pacote local de
  composição chama-se `aws`).

## 12. Testes (a partir da fase de implementação de cada handler)

- Table-driven; um `t.Run` por caso; `t.Parallel()` quando não há estado compartilhado.
- Sem rede em teste unitário.
- **Mocks dos ports via `go.uber.org/mock` (mockgen)**, não fakes à mão. As diretivas
  `//go:generate go tool mockgen -typed` ficam em `<port pkg>/mocks/generate.go`,
  **uma por interface** → **um arquivo por interface** (`mocks/documento_storage.go`,
  `mocks/token_service.go`, …), `-package mocks`. O pacote gerado é **commitado**.
  Rodar `make generate` após alterar qualquer port. `mockgen` entra via diretiva
  `tool` no `go.mod` (`go get -tool go.uber.org/mock/mockgen`) — sem binário no PATH.
  Preferir `-typed` (expectativas com tipos), `gomock.InOrder` para sequência, e
  "nenhum `EXPECT()`" para provar que um caminho não dispara efeito colateral.
- Um *store* stateful de teste (ex.: repositório de sessão que precisa de `semeia`
  + leitura consistente entre chamadas) pode continuar como fake à mão quando o
  mock por expectativa deixaria o teste ilegível — decisão caso a caso.
- Testes de integração contra Floci sob build tag `//go:build integration`.
- `-race` no CI.

## 13. Gate de "done" por batch

- `make lint` (`go vet ./...` + `gofmt -l` vazio) verde.
- `make test` verde.
- `docker compose build api-go` verde (o builder roda `go vet` como gate adicional).
- `golangci-lint run` limpo — **a partir da spec 023** (não exigido no scaffold 022).
  Instalar com `go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest`;
  precisa ser **≥ v2.13** para Go 1.27 (versões antigas quebram com "export data version 4").
  Config em `apps/backend/.golangci.yml` (`default: standard` + `revive` + `unconvert`;
  `misspell` fora — comentários em pt-BR).
