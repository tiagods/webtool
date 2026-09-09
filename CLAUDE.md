# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Agent Rules

The agent workflow is defined in [`.claude/CLAUDE.md`](.claude/CLAUDE.md). Read it at the start of every session — it defines the spec-first development cycle, git restrictions, and self-improvement rules.

## Commands

Run all commands from the repo root:

```bash
npm install          # Install web + shared workspace dependencies
npm run dev          # Start apps/web dev server on http://localhost:3000
npm run build        # Production build (apps/web)
npm run lint         # ESLint check (apps/web)
```

`apps/api` is a **Go module** — its commands live in `apps/api/Makefile` (run from Git Bash):
```bash
make -C apps/api run              # go run ./cmd/api  (needs JWT_SECRET + APP_ENV in env)
make -C apps/api build APP=api    # static binary → apps/api/bin/
make -C apps/api lint             # go vet + gofmt + golangci-lint
make -C apps/api test             # go test ./... -race
make -C apps/api test-integration # needs `docker compose up -d floci aws-init`
```

Full local flow without Docker: run `npm run dev -w apps/web` (3000) and `make -C apps/api run` (3001) in
parallel — `apps/web/next.config.mjs` proxies `/api/:path*` to `:3001` in dev, so the whole flow works
through `http://localhost:3000` alone. Via Docker: `npm run infra:up` (`docker compose up -d --build`),
available at `http://localhost` (port 80, via Nginx).

The Go module has unit + integration tests (`make -C apps/api test`); `apps/web` has no test command yet.
The Go validator is verified against the shared Zod schemas by a characterization suite
(`node scripts/gen-abertura-characterization.mjs` / `gen-alteracao-characterization.mjs`).

## Architecture

**Monorepo** (npm workspaces for `apps/web` + `apps/api-node` + `packages/*`; `apps/api` is a standalone Go module):
- `apps/web` — Next.js 14+ (App Router) frontend only (pages, form, `middleware.ts` for the LGPD banner). No AWS access.
- `apps/api` — **Go** (Echo + Clean Architecture): `/api/session`, `/api/draft`, `/api/upload-url`, `/api/submit`, `/api/aceite-termo`, `/api/alteracao/*`, `DELETE /api/session`. `cmd/api` (HTTP) + `cmd/worker` (SQS consumer, Phase 7). **Not exposed publicly in production** — port 3001 is published in `docker-compose*.yml` for local debug, but the production server firewall blocks external access; only Nginx (and same-host traffic) can reach it. Layers: `domain/{entity,ports,service,validation}`, `adapter/web/{handler,presenter}`, `infrastructure/{config,auth,aws,middleware,...}`.
- `apps/api-node` — legacy Next.js Route Handlers implementation, kept for cutover rollback (spec 028); removed after production verification.
- `apps/worker` — [Planned Phase 7] the `cmd/worker` binary of the `apps/api` Go module, run as a long-running Docker container: PDF generation, email via SNS→SES. See [`.claude/specs/013-worker-pdf-email.md`](.claude/specs/013-worker-pdf-email.md)
- `packages/shared` — `@prolink/shared`: Zod schemas and TypeScript types used by `web` and `api-node`; the Go validator in `apps/api` mirrors these schemas (characterization-tested).
- `infra/nginx` — reverse proxy, the recommended public entry point (port 80); routes `/` → `web`, `/api/*` → `api`

**Main user flow** (`/abertura`):
1. Multi-step company registration form (5–6 steps depending on `tipoSociedade`: Ltda vs SLU)
2. Draft saved to DynamoDB at each step (TTL 2h), keyed by session JWT (httpOnly cookie)
3. File uploads go directly to S3 via presigned URLs
4. Final submission validates, backs up to S3, publishes to SQS
5. Worker container consumes the SQS message, generates the PDF and sends the notification email via SNS→SES

**Key files:**
- `apps/web/app/abertura/StepperEngine.tsx` — orchestrates steps, form state, and navigation; calls relative `/api/*` paths (routed to `apps/api` by Nginx in production, or by the dev-only rewrite in `apps/web/next.config.mjs` — no client-side branching needed)
- `apps/web/components/forms/` — one component per step (DadosEmpresa, Endereco, Socios, Sociedade, Documentos, Revisao)
- `packages/shared/src/schemas/` — Zod validation schemas (source of truth for form data shape; the Go validator in `apps/api/domain/validation` mirrors them)
- `apps/api/domain/validation/` — Go port of the Zod schemas; `testdata/` holds the characterization cases + expected verdicts generated from the shared schemas
- `apps/api/infrastructure/config/config.go` — the only place that reads env; `apps/api/adapter/web/router.go` wires routes → handlers
- `apps/web/tailwind.config.ts` — design token colors (`brand`, `accent`, `sky`, `success`, `error`, `muted`, `border`, `surface`)

**Dependency rule** (Clean Architecture — see `.claude/rules/boas-praticas-go.md` for the Go layout):
```
adapters → domain ← use_cases
infra → adapters, domain, use_cases
```

**Shared package import:** use `@prolink/shared` (workspace-linked, no build step needed in dev) — `web`/`api-node` only.

## Design System

Font families: `Inter` (sans) and `Inter Display` (display). Use `px` for font sizes, `em` for letter-spacing, `px` for line-height. Full palette and component guidelines are in [`docs/design-system.md`](docs/design-system.md).

## Documentation

- [`docs/arquitetura.md`](docs/arquitetura.md) — AWS infrastructure, API routes, cost model, Docker/Nginx network topology
- [`docs/ficha-abertura.md`](docs/ficha-abertura.md) — business rules for the company registration form
- [`.claude/specs/009-separacao-frontend-backend.md`](.claude/specs/009-separacao-frontend-backend.md) — frontend/backend split design
- [`deploy.md`](deploy.md) — production deploy via `docker-compose.prod.yml`, including the server firewall prerequisite
- [`docs/design-system.md`](docs/design-system.md) — colors, typography, spacing, component rules
