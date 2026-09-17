# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Agent Rules

The agent workflow is defined in [`.claude/CLAUDE.md`](.claude/CLAUDE.md). Read it at the start of every session — it defines the spec-first development cycle, the git convention (organized commits, push only on a proven-done spec), and self-improvement rules.

## Commands

Run all commands from the repo root:

```bash
npm install          # Install web + shared workspace dependencies
npm run dev          # Start apps/web dev server on http://localhost:3000
npm run build        # Production build (apps/web)
npm run lint         # ESLint check (apps/web)
```

`apps/backend` is a **Go module** — its commands live in `apps/backend/Makefile` (run from Git Bash):
```bash
make -C apps/backend run              # go run ./cmd/api  (needs JWT_SECRET + APP_ENV in env)
make -C apps/backend build APP=api    # static binary → apps/backend/bin/
make -C apps/backend lint             # go vet + gofmt + golangci-lint
make -C apps/backend test             # go test ./... -race
make -C apps/backend test-integration # needs `docker compose up -d floci aws-init`
```

Full local flow without Docker: run `npm run dev -w apps/web` (3000) and `make -C apps/backend run` (3001) in
parallel — `apps/web/next.config.mjs` proxies `/api/:path*` to `:3001` in dev, so the whole flow works
through `http://localhost:3000` alone. Via Docker: `npm run infra:up` (`docker compose up -d --build`),
available at `http://localhost` (port 80, via Nginx).

**One stack at a time across worktrees:** `docker-compose.yml` hardcodes `container_name: prolink-*`
and publishes fixed host ports (4566, 3000, 3001, 80), so `npm run infra:up`, `npm run dev` and
`make -C apps/backend test-integration` can only run in one worktree at a time. Editing code and
running `make -C apps/backend test` / `npm run lint` in parallel worktrees is fine.

The Go module has unit + integration tests (`make -C apps/backend test`); `apps/web` has no test command yet.
The Go validator is verified against the shared Zod schemas by a characterization suite
(`node scripts/gen-abertura-characterization.mjs` / `gen-alteracao-characterization.mjs`).

## Architecture

**Monorepo** (npm workspaces for `apps/web` + `packages/*`; `apps/backend` is a standalone Go module):
- `apps/web` — Next.js 14+ (App Router) frontend only (pages, form, `middleware.ts` for the LGPD banner). No AWS access.
- `apps/backend` — **Go** (Echo + Clean Architecture): `/api/session`, `/api/draft`, `/api/upload-url`, `/api/submit`, `/api/aceite-termo`, `/api/alteracao/*`, `DELETE /api/session`. `cmd/api` (HTTP) + `cmd/worker` (SQS consumer, Phase 7). Rewrite of the original Next.js backend (specs 022–028). **Not exposed publicly in production** — port 3001 is published in `docker-compose*.yml` for local debug, but the production server firewall blocks external access; only Nginx (and same-host traffic) can reach it. Layers: `domain/{entity,ports,service,validation}`, `adapter/web/{handler,presenter}`, `infrastructure/{config,auth,aws,middleware,...}`.
- `apps/worker` — [Planned Phase 7] the `cmd/worker` binary of the `apps/backend` Go module, run as a long-running Docker container: PDF generation, email via SNS→SES. See [`.claude/specs/013-worker-pdf-email.md`](.claude/specs/013-worker-pdf-email.md)
- `packages/shared` — `@prolink/shared`: Zod schemas and TypeScript types consumed by `apps/web`; the Go validator in `apps/backend` mirrors these schemas (characterization-tested).
- `infra/nginx` — reverse proxy, the recommended public entry point (port 80); routes `/` → `web`, `/api/*` → `api`

**Main user flow** (`/abertura`):
1. Multi-step company registration form (5–6 steps depending on `tipoSociedade`: Ltda vs SLU)
2. Draft saved to DynamoDB at each step (TTL 2h), keyed by session JWT (httpOnly cookie)
3. File uploads go directly to S3 via presigned URLs
4. Final submission validates, backs up to S3, publishes to SQS
5. Worker container consumes the SQS message, generates the PDF and sends the notification email via SNS→SES

**Key files:**
- `apps/web/app/abertura/StepperEngine.tsx` — orchestrates steps, form state, and navigation; calls relative `/api/*` paths (routed to `apps/backend` by Nginx in production, or by the dev-only rewrite in `apps/web/next.config.mjs` — no client-side branching needed)
- `apps/web/components/forms/` — one component per step (DadosEmpresa, Endereco, Socios, Sociedade, Documentos, Revisao)
- `packages/shared/src/schemas/` — Zod validation schemas (source of truth for form data shape; the Go validator in `apps/backend/domain/validation` mirrors them)
- `apps/backend/domain/validation/` — Go port of the Zod schemas; `testdata/` holds the characterization cases + expected verdicts generated from the shared schemas
- `apps/backend/infrastructure/config/config.go` — the only place that reads env; `apps/backend/adapter/web/router.go` wires routes → handlers
- `apps/web/tailwind.config.ts` — design token colors (`brand`, `accent`, `sky`, `success`, `error`, `muted`, `border`, `surface`)

**Dependency rule** (Clean Architecture — see `.claude/rules/boas-praticas-go.md` for the Go layout):
```
adapters → domain ← use_cases
infra → adapters, domain, use_cases
```

**Shared package import:** use `@prolink/shared` (workspace-linked, no build step needed in dev) — `apps/web` only. The Go backend has no npm dep; its validator mirrors `packages/shared/src/schemas`.

## Design System

Font families: `Inter` (sans) and `Inter Display` (display). Use `px` for font sizes, `em` for letter-spacing, `px` for line-height. Full palette and component guidelines are in [`docs/design-system.md`](docs/design-system.md).

## Documentation

- [`docs/arquitetura.md`](docs/arquitetura.md) — AWS infrastructure, API routes, cost model, Docker/Nginx network topology
- [`docs/ficha-abertura.md`](docs/ficha-abertura.md) — business rules for the company registration form
- [`.claude/specs/009-separacao-frontend-backend.md`](.claude/specs/009-separacao-frontend-backend.md) — frontend/backend split design
- [`deploy.md`](deploy.md) — production deploy via `docker-compose.prod.yml`, including the server firewall prerequisite
- [`docs/design-system.md`](docs/design-system.md) — colors, typography, spacing, component rules
