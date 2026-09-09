---
id: "029"
title: "Renomear apps/api → apps/backend e remover apps/api-node"
status: done           # draft | review | approved | in-progress | done | rejected
created: 2026-09-08
author: "tiagods"
batch_size: "small"    # small (≤ meio dia) | medium (≤1 dia)
depends_on: ["028"]    # o cutover Go tem que estar commitado antes do rename
---

# Renomear `apps/api` → `apps/backend` e remover `apps/api-node`

## Contexto

Depois do cutover da spec 028, o monorepo tem `apps/web` (Next.js), `apps/api` (módulo Go com
`cmd/api` **e** `cmd/worker`) e `apps/api-node` (a implementação Next.js antiga, mantida só como
rede de segurança do cutover). Dois incômodos:

- `apps/api` hoje é um **módulo Go** que produz dois binários (`cmd/api`, `cmd/worker`). O nome
  "api" sugere que só existe o serviço HTTP e torna estranho ter `apps/api/cmd/worker`.
  "backend" descreve melhor: é *o* backend do sistema, com os dois entrypoints.
- `apps/api-node` já não é buildado por nenhum compose e só existe como rollback. Com o 028
  commitado, o rollback do cutover é `git revert` do commit — a pasta viva é redundância que
  polui `grep`, workspaces npm e o `COPY` do Dockerfile de `apps/web`.

`apps/web` **não** é renomeado — o nome está consolidado em specs, docs e no serviço Compose, e
o ganho não paga o churn.

Layout Go: mantém o **plano** (`domain/ adapter/ infrastructure/ cmd/` no topo do módulo — **sem**
`internal/**`, conforme `.claude/rules/boas-praticas-go.md`).

## Objetivo

Sem mudança de comportamento:

1. `git mv apps/api apps/backend`
2. `git rm -r apps/api-node` — e **remover todas as referências** a `apps/api-node` (workspaces,
   `COPY` do Dockerfile de `apps/web`, `package-lock.json`, `Makefile` raiz, docs, notas de rollback)
3. Module path Go: `github.com/tiagods/webtool/apps/api` → `github.com/tiagods/webtool/apps/backend`
   em todos os `.go` + `go.mod`
4. **Nome do serviço no Docker Compose continua `api`** (só muda `build.context` para `./apps/backend`) —
   assim `infra/nginx` (`proxy_pass http://api:3001`) **não muda**.
5. Atualizar workspaces, o Dockerfile de `apps/web`, `Makefile` raiz, scripts, `.env.example`,
   `.gitignore`, `.gitattributes` e a documentação viva.

Isto **conclui e substitui** o item 6 das Notas da spec 028 ("Após verificação em produção:
deletar `apps/api-node`") — a decisão passou a ser remover já, confiando no `git revert` como
rollback.

## Análise — `packages/shared` ainda se justifica?

Com `apps/api-node` removido, o **único consumidor de runtime** de `@prolink/shared` passa a ser
`apps/web` (24 arquivos). Surge a pergunta: mover `packages/shared/src/*` para dentro de
`apps/web` e apagar o workspace?

**Consumidores reais depois da 029:**

| Consumidor | Como usa | Precisa de path estável? |
|---|---|---|
| `apps/web` (24 arquivos) | `import { … } from '@prolink/shared'` (schemas Zod em runtime + tipos) | não — alias resolveria |
| `scripts/gen-{abertura,alteracao}-characterization.mjs` | `import '../packages/shared/src/schemas/*.ts'` (roda o Zod real p/ gerar o testdata do validador Go) | **sim** — ferramenta de verificação a nível de repo |
| `apps/backend/domain/validation/*` (Go) | **espelha** os schemas; comentários apontam `packages/shared/src/schemas/*.ts` | referência textual |

**Decisão: manter `packages/shared`.** Motivo: os schemas Zod não são validação de view do
frontend — são um **contrato entre linguagens**. O validador Go de `apps/backend` os reimplementa
e a suíte de caracterização (`scripts/gen-*`) roda o Zod original contra payloads para provar a
paridade. Esse contrato precisa morar num lugar que não seja "dentro do frontend": movê-lo para
`apps/web/lib/` faria uma ferramenta de verificação de repo depender de um diretório interno de
uma app, e faria o contrato parecer detalhe de implementação do web. O custo de manter é ~2
arquivos de config (`package.json` de 8 linhas + `tsconfig.json`); o ganho de mover é só esses
~30 LOC, ao preço de embaralhar a semântica.

**O que a 029 ajusta em `packages/shared` mesmo mantendo:**

- `packages/shared/package.json`: sem mudança (só `zod`).
- Toda a documentação que diz "compartilhado por `web` **e** `api-node`" → "consumido por
  `apps/web`; espelhado pelo validador Go de `apps/backend` (caracterização)".
- Specs 015/016/017 (testes unitários, ainda `draft`) referenciam um `vitest.workspace.ts` com
  `apps/web` + `apps/api` (Node) + `packages/shared` — já estavam desatualizadas pós-028; a 029
  só troca `apps/api` → `apps/backend`/remove, não reescreve o design de testes.

> Se a revisão da spec decidir mover mesmo assim: destino `apps/web/shared/` (mantendo
> `schemas/ constants/ index.ts`), alias `@/shared`, `zod` vira dep de `apps/web`, `workspaces`
> some, Dockerfile de `apps/web` perde 2 `COPY`, `scripts/gen-*` passam a apontar
> `../apps/web/shared/schemas/*.ts`. É reversível, mas não é a recomendação.

## Análise — pasta `scripts/`

Conteúdo atual (5 arquivos):

| Arquivo | Consumido por | Precisa existir? |
|---|---|---|
| `scripts/gen-abertura-characterization.mjs` | `apps/backend/domain/validation/abertura_test.go` (fixa o veredito Zod) + spec 025 + CLAUDE.md | **sim** — sem ele o `go test` da validação de abertura não tem baseline |
| `scripts/gen-alteracao-characterization.mjs` | idem, para `alteracao_test.go` | **sim** |
| `scripts/verify-jwt-cross.mjs` | `apps/backend/infrastructure/auth/jwt_cross_test.go` **executa** este arquivo (`node …/scripts/verify-jwt-cross.mjs`) via `filepath.Join("..","..","..","..","scripts",…)` | **sim** — um teste Go depende dele em runtime |
| `scripts/test/dynamodb-query.sh` | uso manual (inspeção do Floci: rascunhos, aceites LGPD) | opcional — 58 LOC, autodocumentado, custo zero |
| `scripts/test/s3-query.sh` | uso manual (inspeção do Floci: objetos S3 por sessão/protocolo) | opcional — 63 LOC, idem |

**Decisão: manter todos, e manter `scripts/` na raiz.** Os 3 `.mjs` são a **cola entre
linguagens**: TS/Zod de `packages/shared` → fixtures JSON de `apps/backend`, e a checagem de
interop JWT (o `jose` de `apps/web` ↔ o `golang-jwt` de `apps/backend`). Isso não pertence a
nenhuma app isolada:

- Mover para `apps/backend/` quebra a resolução de `jose`/`zod` (não há `node_modules` num módulo Go).
- Mover para `packages/shared/scripts/` seria possível para os `gen-*` (consomem os schemas),
  mas eles **escrevem** em `apps/backend/domain/validation/testdata/` — a mesma inversão que se
  evitou com `packages/shared`. E `jwt_cross_test.go` fixa o path `…/scripts/verify-jwt-cross.mjs`
  a partir da raiz.
- `scripts/` na raiz é exatamente onde ferramenta transversal (web + shared + backend) deve morar.

**Ações da 029 em `scripts/`:**

- Comentários/paths `apps/api/…` → `apps/backend/…` nos 3 `.mjs` (e nas strings em `abertura.go`
  / `alteracao.go` que citam o nome do script — o nome não muda, só o caminho de saída no texto).
- `jwt_cross_test.go`: a contagem de `..` **não muda** (a profundidade `apps/<x>/infrastructure/auth`
  é a mesma) — só conferir.
- `scripts/test/*.sh`: sem mudança de conteúdo (usam nomes de tabela/bucket, não caminhos de app).
- **Rastreamento:** os 3 `.mjs` estão *untracked* hoje — o usuário deve `git add scripts/*.mjs`
  no commit da 028 (ou da 029), já que `go test ./...` depende deles. Não é ação de código, é
  lembrete de commit.

## Fora de escopo

- Renomear `apps/web` — fica como está.
- Mover/apagar `packages/shared` — analisado acima; decisão é **manter** (rever só se a revisão da spec discordar).
- Mover/enxugar `scripts/` — analisado acima; decisão é **manter na raiz** (os 2 `.sh` de debug ficam).
- Adotar `internal/` ou o "Standard Go Project Layout" — o layout plano fica.
- Renomear os **serviços** do Compose (`web`, `api`, `nginx`, `floci`) ou qualquer coisa em
  `infra/nginx` / `Caddyfile`.
- Reescrever specs históricas fechadas (001–021): ficam com os nomes antigos; quando muito, uma
  nota de rodapé no README/arquitetura explicando o rename.
- Qualquer mudança na spec 013 (worker) além de trocar `apps/api` por `apps/backend` nas
  referências de caminho.

## Design

### Camadas afetadas

| Área | Arquivo(s) | Ação |
|------|-----------|------|
| Dir | `apps/api` → `apps/backend` | `git mv` (usuário) |
| **`apps/api-node/`** | diretório inteiro | **`git rm -r` (usuário)** |
| Go module | `apps/backend/go.mod` (`module …/apps/backend`) + ~61 `.go` (import path) | EDIT (sed) |
| Go comentários | `apps/backend/{Dockerfile,Makefile}`, `infrastructure/auth/*` (path do `middleware.ts`) | EDIT |
| Compose dev | `docker-compose.yml`: `api.build.context: ./apps/api` → `./apps/backend` | EDIT |
| Compose prod | `docker-compose.prod.yml`: idem | EDIT |
| web Dockerfile | `apps/web/Dockerfile`: **remover** a linha `COPY apps/api-node/package.json …` | EDIT |
| Workspaces | `package.json`: lista vira `["apps/web", "packages/*"]` (sem `apps/api-node`) | EDIT |
| Lockfile | `package-lock.json` — sem entrada `apps/api-node` | REGEN (`npm install`) |
| Makefile raiz | remover menções a `apps/api-node` (`clean` não deve mais listá-lo); texto "apps/api" → "apps/backend" | EDIT |
| Scripts | `scripts/gen-*-characterization.mjs`: comentários `apps/api/…` → `apps/backend/…` (o `import` de `../packages/shared/…` **não muda** — ver Análise) | EDIT |
| `packages/shared` | código: **nenhuma mudança**; só a documentação que o descreve (ver abaixo) | — |
| Config raiz | `.env.example`, `.gitignore` (`/apps/api/bin/` → `/apps/backend/bin/`), `.gitattributes` (nenhuma) | EDIT |
| Docs vivas | `README.md`, `CLAUDE.md`, `.claude/CLAUDE.md`, `docs/arquitetura.md`, `docs/aws.md`, `deploy.md`, `.claude/rules/boas-praticas-go.md` — (a) tirar `apps/api-node` e as notas de rollback via pasta; (b) `packages/shared` "compartilhado por web **e** api-node" → "consumido por `apps/web`; espelhado pelo validador Go de `apps/backend`" | EDIT |
| Go comentários (paridade) | `apps/backend/domain/{entity,validation}/*`: `@prolink/shared` / `packages/shared/src/…` seguem válidos (o pacote fica) — só conferir | REVISAR |
| Spec worker | `.claude/specs/013-worker-pdf-email.md`: `apps/api` → `apps/backend` | EDIT |
| Spec 028 | nota de que o item 6 foi concluído pela spec 029 | EDIT |

### Invariante-chave

```
serviço compose "web"  → apps/web        → container escuta :3000
serviço compose "api"  → apps/backend    → container escuta :3001
infra/nginx/default.conf: proxy_pass http://web:3000 / http://api:3001   (INALTERADO)
```

O rename é puramente de **origem de código**; a topologia de rede/deploy não muda.

## Critérios de aceite

- [x] `apps/api` e `apps/api-node` não existem mais; `apps/web` e `apps/backend` são as únicas apps
- [x] `go -C apps/backend build ./...`, `vet ./...`, `test ./... -race` verdes; `go mod tidy` limpo
- [x] `golangci-lint run ./...` limpo em `apps/backend` (0 issues)
- [x] `npm install` + `npm run build -w apps/web` + `npm run lint -w apps/web` verdes
- [x] `docker compose build` e `docker compose -f docker-compose.prod.yml config` verdes
- [x] `infra/nginx/` e `Caddyfile` **byte-idênticos** ao estado pós-028 (`git diff` vazio)
- [x] E2E de contrato (27 checks: Abertura Ltda/SLU, Alteração, LGPD 403/409/200, rate limit 429,
      JWT cross) — **27 PASS / 0 FAIL** via `http://localhost` com o nginx inalterado
- [x] `grep`: refs restantes a `apps/api` são só provenance em comentários `.go` + o report datado
      `owasp-audit-2026-07-08.md` — nenhuma doc viva incorreta
- [x] `package-lock.json` sem entrada `apps/api-node`; workspaces = `["apps/web", "packages/*"]`
- [x] Docs vivas atualizadas; notas de rollback via pasta `apps/api-node` removidas
- [x] `.claude/tasks/lessons.md` atualizado (+3 lições)

## Notas

- **Ordem:** commitar a spec 028 primeiro (senão o histórico fica com um rename encavalado no outro).
- **Rollback do cutover Go (o que `apps/api-node` protegia):** com o 028 commitado, é `git revert`
  do commit do 028 — restaura `apps/api` Node e os serviços antigos. A pasta viva não agregava
  nada além disso.
- **Rollback do próprio 029:** `git mv` reverso + reverter `build.context` nos dois compose +
  `git revert` do commit que apagou `apps/api-node`. Nginx nunca entra no rollback.
- Renomear `apps/api` e apagar `apps/api-node` no mesmo batch: é a mesma decisão ("só apps vivas
  na árvore, nomeadas por papel") e evita duas rodadas de `npm install` / rebuild de imagem.
- Verificar antes de apagar `apps/api-node`: `docker compose config` e `-f docker-compose.prod.yml
  config` não devem referenciá-lo (já é o caso pós-028) — o delete é seguro.
