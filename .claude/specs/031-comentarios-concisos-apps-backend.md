---
id: "031"
title: "Auditar comentários de apps/backend contra boas-praticas.md §6"
status: done           # draft | review | approved | in-progress | done | rejected
created: 2026-09-08
author: "tiagods"
batch_size: "small"    # small (≤ meio dia)
depends_on: ["029"]    # a árvore já é apps/backend
touches: ["apps/backend/**"]
---

# Auditar comentários de `apps/backend` contra `boas-praticas.md` §6

## Contexto

`boas-praticas.md` §6 ganhou regras mais duras para comentários (edição manual, 2026-09-08):

> - Comente de forma concisa, **sem referências que não o código em si**.
> - Evite comentários que descrevam o que o código já expressa claramente.
> - Evite narrar um fluxo completo de código — prefira o **porquê** de uma decisão.
> - Evite referências a outros arquivos ou documentações externas — mantenha o contexto no próprio código.
> - Evite explicar demais um processo, mesmo fora do fluxo (ex.: `main.go` já invoca um `Start`; não comente que o `Start` é invocado, e sim **por que** ali).

O código Go de `apps/backend` (specs 022–028) foi escrito antes dessa regra e a viola em vários
pontos: **27 linhas de comentário** citam `apps/api/*.ts`, `@prolink/shared`,
`packages/shared/src/...`, `apps/web/middleware.ts` ou "spec NNN" — âncoras para arquivos que
mudam de lugar ou já nem existem (`apps/api-node` foi removido na spec 029). Além dessas,
há doc-comments que narram o fluxo passo a passo em vez de registrar a decisão.

## Objetivo

Passar por **todo comentário** de `apps/backend/**/*.go` (93 arquivos, incl. `_test.go`) e, sem
mudar uma linha de código executável:

1. **Remover a referência externa**, mantendo a informação quando ela é a regra em si.
   - ❌ `// Espelha o expiresIn = 300 de apps/api/lib/aws/s3.ts.`
   - ✅ `// URL válida por 5 min.`
   - ❌ `// TERMO_VERSAO_ATUAL de @prolink/shared (packages/shared/src/constants/termo.ts):`
   - ✅ `// Versão vigente do termo de ciência. O front usa a sua própria cópia; divergência = 400.`
2. **Cortar narração de fluxo** em doc-comment — deixar o "o quê" na assinatura e o "porquê" no texto.
   - ❌ `// Submeter valida o payload, busca o rascunho, gera protocolo, copia documentos, publica…`
   - ✅ `// Submeter finaliza a ficha. A ordem (copiar → publicar → marcar enviado → limpar) é
        deliberada: nada irreversível antes da cópia dos documentos ter sucesso.`
3. **Apagar comentário que repete o código** (ex.: `// invoca StartApp` sobre `StartApp()`).
4. **Manter e melhorar** o que registra decisão, restrição ou regra não óbvia (TTL de 5 anos por
   LGPD, janela de rate limit, ordem de operações no submit, compat de assinatura JWT com o front).
5. Doc-comment de identificador exportado continua **começando pelo nome** do identificador
   (regra Go / `boas-praticas-go.md` §2/§6) — só o corpo muda.

### Caso especial — paridade com o front

O ponto legítimo por trás de "espelha X.ts" é que **o validador Go e o schema Zod têm que
concordar**. Isso não se ancora num path — se ancora na **suíte de caracterização**. Onde o
comentário só existia para dizer "isto veio do Zod", trocar por uma nota única no topo de
`domain/validation/` (ex.: em `abertura.go`) do tipo: "Divergências deste validador em relação
ao schema do front são pegas por `*_test.go` (casos gerados em `testdata/`)." — **uma** referência
a teste, no lugar de dez a arquivos `.ts`.

## Fora de escopo

- Qualquer mudança em código executável, nomes, assinaturas ou testes (só texto de comentário).
- `apps/web`, `packages/shared`, `scripts/`, `docs/`, specs — a regra é geral, mas este batch
  cobre só `apps/backend`.
- Reescrever `boas-praticas-go.md` (ele já manda "comentário registra decisão, não repete o código").

## Design

Arquivo por arquivo, começando pelos ~27 hits de referência externa (lista via
`grep -rn '//.*\(\.ts\|@prolink/\|packages/shared\|apps/api\|middleware\.ts\|[Ss]pec [0-9]\)' apps/backend --include='*.go'`),
depois uma varredura dos doc-comments de cada pacote (`domain/`, `adapter/`, `infrastructure/`,
`cmd/`) para os itens 2–4.

| Pacote | Nº arquivos | Foco |
|--------|-------------|------|
| `domain/entity` | 7 | refs a `@prolink/shared` / `.ts` em doc-comments de tipo |
| `domain/validation` | 7 | muitas refs a `abertura.ts`/`alteracao.ts`; aplicar o "caso especial" |
| `domain/service` | ~14 | "Espelha apps/api/.../route.ts" + narração de fluxo em `Submeter`/`Salvar` |
| `domain/ports` | ~12 | doc-comments curtos; poucas refs |
| `adapter/web` | ~18 | handlers finos; conferir narração |
| `infrastructure` | ~20 | `auth`, `aws`, `ratelimit`, `middleware` — refs a `.ts` de constantes |
| `cmd` | 2 | `main.go`/`worker` — item 3 e 5 (não comentar o óbvio) |

## Critérios de aceite

- [x] `grep -rn '//.*\(\.ts\|@prolink/\|packages/shared\|apps/api\|apps/web/middleware\)' apps/backend --include='*.go'` → **vazio**
- [x] `grep -rn '//.*[Ss]pec [0-9]' apps/backend --include='*.go'` → vazio (ou só um TODO justificado)
- [x] Nenhum doc-comment narra o passo a passo de uma função (revisão manual pacote a pacote)
- [x] `domain/validation` tem **uma** nota de paridade apontando para a suíte de caracterização
- [x] `go -C apps/backend build ./... && vet ./... && test ./... -race` verdes (nada além de comentário mudou)
- [x] `gofmt -l apps/backend` vazio
- [x] `golangci-lint run ./...` limpo — os 5 issues `revive` de comentário foram corrigidos aqui; os 5 de código foram zerados na spec 032 (mesma branch)
- [x] `git diff` mostra **só** linhas de comentário

## Notas

- Zero risco funcional — é só texto. O gate é o `git diff` (só `//` e blocos `/* */`) + a suíte
  de testes intacta.
- Depois deste batch, a regra vale para código novo — code review rejeita comentário com path.
