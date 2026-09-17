---
id: "032"
title: "Zerar o lint de apps/backend (errcheck + staticcheck)"
status: done           # draft | review | approved | in-progress | done | rejected
created: 2026-09-17
author: "tiagods"
batch_size: "small"    # small (≤ meio dia)
depends_on: []         # HARD - sem estas specs a mudanca nao compila/nao faz sentido
prefer_after: ["031"]
touches: ["apps/backend/**"]
---

# Zerar o lint de `apps/backend` (errcheck + staticcheck)

## Contexto

A spec 031 (auditoria de comentários) encontrou `make -C apps/backend lint` **vermelho no
`origin/main`**, com 10 issues pré-existentes. Em 031 foram corrigidos os 5 de comentário
(`revive`: doc-comments faltantes em `domain/service/notificar.go` e
`infrastructure/aws/s3.go`). Restam **5 issues de código**:

| Linter | Local | Issue |
|--------|-------|-------|
| errcheck | `infrastructure/email/smtp.go:71` | `defer client.Close()` sem tratar o erro |
| errcheck | `infrastructure/email/smtp.go:119` | `defer conn.Close()` sem tratar o erro |
| errcheck | `infrastructure/email/smtp.go:125` | `defer client.Close()` sem tratar o erro |
| errcheck | `infrastructure/worker_controller.go:82` | retorno de `deleteMessage` ignorado |
| staticcheck | `infrastructure/email/smtp.go:45` | `WriteString(fmt.Sprintf(...))` (QF1012) |

## Objetivo

Deixar `golangci-lint run ./...` **limpo** em `apps/backend`, corrigindo só esses 5 pontos,
sem alterar comportamento observável.

## Fora de escopo

- Qualquer regra/feature nova.
- Comentários — a auditoria de §6 já é a spec 031.
- Mudar a configuração do linter (`.golangci.yml`) para silenciar os checks.

## Design

- `smtp.go` — envolver os `defer Close()` em closure que descarta o erro de forma explícita
  (`defer func() { _ = client.Close() }()`); trocar o laço de headers por
  `fmt.Fprintf(&buf, "%s: %s\r\n", k, v)`.
- `worker_controller.go` — capturar o erro de `deleteMessage` e logar com `slog.Error`
  (o delete já é best-effort hoje; só falta o registro).

### Camadas afetadas

| Camada | Arquivo | Ação |
|--------|---------|------|
| Infrastructure | `apps/backend/infrastructure/email/smtp.go` | MODIFY |
| Infrastructure | `apps/backend/infrastructure/worker_controller.go` | MODIFY |

## Critérios de aceite

- [x] `golangci-lint run ./...` limpo em `apps/backend`
- [x] `go -C apps/backend build ./... && vet ./... && test ./... -race` verdes
- [x] `git diff` não muda nenhuma assinatura/comportamento (só tratamento de erro + `Fprintf`)

Gates do escopo tocado verdes (ver tabela em `.claude/commands/done.md`):
- `apps/backend/**` → `make -C apps/backend lint` + `make -C apps/backend test` + `docker compose build api-go`

## Notas

- Descoberta durante a spec 031; os 4 `errcheck` já existiam desde a migração Go (022–028).
- O `deleteMessage` no loop do worker é best-effort (o SQS recoloca a mensagem), então basta
  registrar o erro — não mudar o fluxo.
