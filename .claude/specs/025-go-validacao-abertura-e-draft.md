---
id: "025"
title: "Go — validação da Ficha de Abertura + rotas de rascunho e upload-url"
status: done
created: 2026-09-07
author: "tiagods"
batch_size: "medium"
depends_on: ["024"]
---

# Go — validação da Abertura + rascunho + upload-url

## Contexto

Reimplementar em Go a validação Zod de `packages/shared/src/schemas/abertura.ts` (~155–170
LOC + `superRefine` cross-field) e ligar as rotas de rascunho/upload da Abertura.

## Pré-tarefa (obrigatória antes de portar a validação)

Rodar uma suíte de payloads representativos contra o `apps/api` Node atual e **gravar o
veredito esperado** (aceito / rejeitado + campos com issue) por payload. Serve de teste de
caracterização para o validador Go — garante mesma decisão para o mesmo input.

## Objetivo

- `domain/service` (ou `domain/validation`): validador de `AberturaForm` field-level +
  funções cross-field nomeadas e testáveis:
  - Ltda exige ≥ 2 sócios
  - soma das quotas = 100 (±0,01)
  - ≥ 1 administrador
  - `quotas.length == socios.length`
  - `cnpjParticipacao` obrigatório se `teveParticipacaoSocietaria`
- Semântica dos drafts: `strict + partial` — rejeitar chave de topo desconhecida
  (`json.Decoder.DisallowUnknownFields`), aceitar qualquer subconjunto; `documentosAceitos`
  não exige `true` no draft.
- `DraftService` + rotas:
  - `GET /api/draft` → `{payload, documentosKeys}`
  - `POST /api/draft` — 2 variantes: `{uploadedCampo, contentType}` (valida `^[a-z0-9_]{1,80}$`
    + content-type permitido, grava `documentosKeys.<campo>`) ou payload de formulário
  - `POST /api/upload-url` — rate limit → 429, `requireAceite`, `createOrGetSession`, presign
    PUT, resp `{url}` (key não volta ao cliente)

## Fora de escopo

- Validação/rotas da Ficha de Alteração (spec 027).
- `POST /api/submit` (spec 026).

## Critérios de aceite

- [x] Suíte de caracterização Node gravada e versionada (`testdata/`) — 31 casos em
  `domain/validation/testdata/{casos_abertura,veredito_esperado}.json`, gerados por
  `scripts/gen-abertura-characterization.mjs`
- [x] Validador Go produz o mesmo veredito da suíte para todos os payloads — 31/31
  (`TestCaracterizacaoAbertura`: `aceito` + conjunto de `issuePaths`)
- [x] Drafts: chave de topo desconhecida → 400; subconjunto parcial → 200
- [x] `GET/POST /api/draft` e `POST /api/upload-url` com contrato equivalente ao Node
  (ver "Divergências intencionais")
- [x] `make lint` + `make test` verdes; `docker compose build api-go` verde;
  `golangci-lint run` limpo

## Divergências intencionais (Go vs Node)

1. **Sessão já `enviado` batendo em `GET/POST /api/draft`**: Node responde **403**
   (`requireSession` → false); o `guardSessao` Go (spec 024) responde **409**
   (`ErrSessaoEnviada`). Mantida a convenção da 024 (semântica mais correta).
   `/api/upload-url` não usa `guardSessao` → não afetado.
2. **Corpo JSON malformado**: Node cai no `catch` → **500**; Go responde **400**
   (`"corpo inválido"` / `"corpo da requisição inválido"`).
3. **`issues` no corpo 400 de `POST /api/draft`**: Node devolve os objetos de issue do
   Zod (`code`/`path`/`message`/...); Go devolve `{path, message}`. `error` e status
   idênticos.

## Notas

- Lição spec 010: `.partial()` do Zod não relaxa `.refine()` — no Go, `documentosAceitos`
  é tratado como booleano opcional no draft (`ValidarAberturaDraft`).
- Semântica do `superRefine` fixada por probes: cross-field só roda se não houver erro
  "aborted" (`invalid_type`/`invalid_enum_value`); regex/min/max/refine-de-campo são "dirty"
  e não bloqueiam. Ver `domain/validation/abertura.go` (`validador.aborted`).
- Mapa content-type→extensão + regex de campo movidos de `infrastructure/aws/s3.go` para
  `domain/entity/documento.go` (regra de domínio, não AWS).
