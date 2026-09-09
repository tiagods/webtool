---
id: "028"
title: "Go — verificação de contrato E2E e cutover (apps/api → Go)"
status: done
created: 2026-09-07
author: "tiagods"
batch_size: "medium"
depends_on: ["027"]
---

# Go — verificação de contrato E2E e cutover

## Contexto

Com todos os 10 handlers portados (specs 024–027), este batch prova que o `apps/web` **sem
nenhuma alteração** funciona contra a API Go, e faz a troca definitiva.

## Objetivo

### Verificação (via Docker + Floci, `apps/web` intocado apontando para a API Go)

- Abertura Ltda e SLU: aceite → sessão → draft (todos os passos) → upload → submit → protocolo
- Alteração: fluxo completo por quadro → submit → `ALT-...`
- `DELETE /api/session` (LGPD): 403 / 409 / limpeza
- Rate limit em `/api/upload-url` → 429
- Cookies e JWT: `prolink_aceite` do Go validado pelo `middleware.ts` do web
- Testes de caracterização (specs 025/027) todos verdes contra o binário Go final

### Cutover

1. `apps/api` → `apps/api-node` (temporário)
2. `apps/api-golang` → `apps/api` — renomear o module path em todos os imports
   (`github.com/tiagods/webtool/apps/api-golang` → `.../apps/api`)
3. `docker-compose.yml`: serviço `api-go` → `api`, `ports` `"3002:3001"` → `"3001:3001"`,
   remover o serviço Node antigo
4. `docker-compose.prod.yml`: serviço `api` passa a buildar do Dockerfile Go (sem `AWS_ENDPOINT_URL`,
   cadeia de credenciais padrão), adicionar `APP_ENV: prod`
5. `infra/nginx/default.conf`: **nenhuma mudança** (`proxy_pass http://api:3001` continua válido)
6. Após verificação em produção: deletar `apps/api-node`
7. Ajustar root `package.json`/`Makefile` (remover `-w apps/api` do build/lint Node; Go tem seu Makefile)

### Documentação

- `docs/arquitetura.md`, `docs/aws.md`, `CLAUDE.md` (raiz e `.claude/`), `README.md`, `deploy.md`
- Marcar specs **018** e **019** como `rejected` (superseded): config centralizada e auth AWS
  única passam a existir nativamente no Go

## Critérios de aceite

- [x] Todos os fluxos E2E acima verdes com `apps/web` sem uma linha alterada (27 PASS / 0 FAIL,
      antes do cutover via repoint temporário do nginx e depois via nginx inalterado)
- [x] `docker-compose.prod.yml`: serviço `api` builda do Dockerfile Go, `APP_ENV=prod`, sem
      `AWS_ENDPOINT_URL` (cadeia de credenciais padrão), `AWS_DYNAMODB_ACEITES_TABLE` adicionada
      *(subida real em produção fica a cargo do deploy — fora do ambiente local)*
- [x] `infra/nginx` não alterado; nginx resolve o upstream `api:3001` → binário Go
- [~] imports renomeados (`…/apps/api-golang` → `…/apps/api` em 61 arquivos); `go build ./...`,
      `go test ./...` e `docker compose build` verdes. `apps/api-node` **mantido** para rollback
      (remoção é follow-up pós-verificação em produção — Notas)
- [x] Docs atualizadas (README, CLAUDE.md, arquitetura, aws, deploy); specs 018/019 `rejected` com motivo
- [x] `.claude/tasks/lessons.md` atualizado com as lições da migração

## Notas

- Rollback: reverter o rename e o `docker-compose*.yml` restaura o `apps/api` Node
  (mantido como `apps/api-node` até a verificação em produção).
- **Atualização (spec 029):** `apps/api` (Go) foi renomeado para `apps/backend` e `apps/api-node`
  foi removido — o item 6 acima ("deletar `apps/api-node`") foi concluído pela spec 029, com o
  rollback do cutover passando a ser `git revert` do commit da migração.
