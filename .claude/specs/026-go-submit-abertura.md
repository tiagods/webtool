---
id: "026"
title: "Go — POST /api/submit (finalização da Ficha de Abertura)"
status: done
created: 2026-09-07
author: "tiagods"
batch_size: "small"
depends_on: ["025"]
---

# Go — `POST /api/submit`

## Contexto

Última rota da Abertura: valida o formulário completo, gera protocolo, move os documentos,
publica na fila e marca a sessão como enviada.

## Objetivo

`SubmitService` + `POST /api/submit`:

1. `requireAceite` + `requireSession`
2. valida `AberturaForm` completo (validador da spec 025, com cross-field)
3. `proximoProtocolo("PRO-", tabelaAbertura)` — contador atômico
4. copia cada `documentosKeys` de `{sessionId}/documentos/` para `protocolos/{protocolo}/`
   em paralelo (`golang.org/x/sync/errgroup`)
5. `publishSubmissao({sessionId, protocolo, formType: "abertura", tipo})` no SQS
6. `marcarEnviado(sessionId, protocolo, tipo)` — zera payload/keys, TTL 30d
7. `deleteObjectsWithPrefix("{sessionId}/")`
8. resp `{protocolo}` + expira o cookie de sessão

## Fora de escopo

- Ficha de Alteração (spec 027).
- Geração de PDF / e-mail (worker — spec 013).

## Critérios de aceite

- [x] Ordem das operações idêntica ao Node (`marcarEnviado` antes de expirar o cookie) —
  `SubmitService.Submeter`: validar → Get → Proximo → copiar (errgroup) → Publish →
  MarcarEnviado → DeletePrefix; o handler expira o cookie só depois. Ordem fixada por
  `TestSubmitService_Submeter/ordem`.
- [x] Cópia S3 paralela com `errgroup`; falha parcial aborta com erro (não deixa estado
  inconsistente silencioso) — `copiarDocumentos` usa `errgroup.WithContext`; a 1ª falha
  cancela as demais e retorna antes de `Publish`/`MarcarEnviado`
  (`TestSubmitService_Submeter/falha_numa_cópia_S3`).
- [x] Protocolo no formato `PRO-{ano UTC}-{6 dígitos}` — `entity.ProtocoloPrefixAbertura`
  = `"PRO-"` passado a `ProtocoloCounter.Proximo`; formatação em `DynamoProtocoloCounter`
  (`%s%d-%06d`, ano via `time.Now().UTC().Year()`), inalterada desde a spec 023.
- [ ] Fluxo E2E: submit de Ltda e de SLU via `apps/web` sem alteração → protocolo gerado,
  mensagem na fila, sessão `enviado` — **pendente** (requer stack Docker completa + navegador;
  a fazer junto do cutover, spec 028).
- [x] `make lint` + `make test` verdes; `docker compose build api-go` verde — no Windows,
  rodados direto: `gofmt -l` vazio, `go vet ./...`, `go test ./... -race`,
  `golangci-lint run ./...` (0 issues), `docker compose build api-go` (imagem `webtool-api-go`).

## Divergências intencionais (Go vs Node)

Herdadas da spec 025 (mesma cadeia de guards e leitura de corpo):

1. **Sessão já `enviado` batendo em `POST /api/submit`**: Node responde **403**
   (`requireSession` → false); o `guardSessao` Go responde **409** (`ErrSessaoEnviada`).
2. **Corpo JSON malformado**: Node cai no `catch` → **500**; Go responde **400**
   (validação trata o corpo como não-objeto e devolve `{error:"Payload inválido", issues:[…]}`).
3. **`issues` no corpo 400**: Node devolve os objetos de issue do Zod; Go devolve
   `{path, message}`. `error` e status idênticos.

## Notas

- `tipo` é regravado no submit com o valor validado (pode ter mudado desde o último draft).
- Datas em UTC (`time.Now().UTC()`), regra do projeto — ano do protocolo via `.UTC().Year()`.
- Toda a infra de ports/adapters (`ProtocoloCounter`, `SubmissaoPublisher`,
  `DocumentoStorage.Copy/DeletePrefix`, `RascunhoRepository.MarcarEnviado`) já existia das
  specs 023–024; a 026 só acrescentou `SubmitService`, o handler `postSubmit`, a rota e o
  wiring no `montarDeps`.
- **Correção pós-batch (pedido do usuário)**: introduzido `go.uber.org/mock` (mockgen)
  via diretiva `tool` no `go.mod`. `domain/ports/outbound/mocks/generate.go` com
  uma diretiva `//go:generate mockgen` por interface → um arquivo de mock por
  interface em `mocks/` (`make generate`). Os testes dos ports que são spies puros
  (`DocumentoStorage`, `AceiteRepository`, `ProtocoloCounter`, `SubmissaoPublisher`)
  passaram a usar os mocks gerados; `fakeRascunhoRepo` (store stateful) e `fakeTokens`
  seguem fakes à mão. Ver `boas-praticas-go` §12 e `lessons.md`.
