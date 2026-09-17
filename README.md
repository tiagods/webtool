# Prolink Contábil — WebTool

Monorepo para ferramentas web da Prolink Contábil, incluindo a Ficha de Abertura de Empresa.

## Estrutura do Repositório

Este projeto utiliza **npm workspaces** para gerenciar múltiplos pacotes e aplicações.

- `apps/web`: Frontend Next.js 14+ (App Router) — páginas e formulário, sem acesso direto à AWS
- `apps/backend`: Backend **Go** (Echo + Clean Architecture, módulo com `cmd/api` + `cmd/worker`) — sessão, rascunho, upload, submit. Reescrita do backend Next.js original (specs 022–028). Não é exposto publicamente em produção (firewall do servidor bloqueia acesso externo à porta 3001); acessível via Nginx (`/api/*`)
- `apps/worker`: *[Planejado para Fase 7]* Container Docker long-running (não Lambda) — consome a fila SQS para processamento assíncrono (geração de PDF, envio de e-mail via SNS→SES). É o binário `cmd/worker` do módulo Go de `apps/backend`
- `packages/shared`: Tipos, constantes e schemas de validação (Zod) consumidos por `apps/web`; o validador Go de `apps/backend` os espelha, verificado por suíte de caracterização.
- `infra/nginx`: Config de proxy reverso — ponto de entrada recomendado (porta 80), roteia `/` para `web` e `/api/*` para `api`.

## Documentação

Mais detalhes sobre o projeto podem ser encontrados na pasta `docs/`.

- [Arquitetura](docs/arquitetura.md)
- [Design System](docs/design-system.md)
- [Regras da Ficha de Abertura](docs/ficha-abertura.md)

## Como rodar

Instale as dependências a partir do diretório raiz:

```bash
npm install
```

### Dev direto (sem Docker)

Suba `web` e `api` em paralelo, cada um em um terminal:

```bash
npm run dev -w apps/web        # http://localhost:3000
make -C apps/backend run       # http://localhost:3001 (Go — exige JWT_SECRET + APP_ENV no env)
```

Em dev, `apps/web/next.config.mjs` tem um `rewrites()` que proxia `/api/:path*` para `http://localhost:3001/api/:path*` — o fluxo completo funciona acessando só `http://localhost:3000`, sem precisar do Nginx.

> **Backend Go (`apps/backend`):** exige `JWT_SECRET` no ambiente — **não há fallback no código**. Para rodar localmente sem Docker, copie `.env.example` para `.env` e exporte as variáveis, ou defina `JWT_SECRET` e `APP_ENV` no shell. O `docker-compose.yml` de dev já injeta `${JWT_SECRET:-dev-secret-change-in-production}`, então o fluxo Docker continua funcionando sem configuração.
>
> **Lint do módulo Go:** `make lint` (em `apps/backend/`) roda `go vet` + `gofmt` + `golangci-lint`. Instale o linter uma vez com `go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest` (exige `~/go/bin` no PATH) — precisa ser ≥ v2.13 para suportar Go 1.27. Testes de integração contra o Floci: `make test-integration` com a stack `docker compose up -d floci aws-init` de pé.
>
> **Verificação cruzada de JWT (spec 024):** o token `prolink_aceite` assinado pela API Go tem que ser aceito pelo `jose` de `apps/web/middleware.ts`. `TestJWT_CompatibilidadeComJose` (`infrastructure/auth`) cobre isso automaticamente quando `node` está no PATH (pula caso contrário). Para checar um token na mão: `JWT_SECRET=<segredo> node scripts/verify-jwt-cross.mjs <token>`.

### Testes unitários (npm)

```bash
npm run test            # vitest run — executa testes de packages/shared + apps/web
npm run test:coverage   # vitest run --coverage — inclui relatório de cobertura (95% piso por arquivo)
```

A suíte cobre:
- **`packages/shared`** — schemas Zod (abertura, alteração, aceite, documentos) e constantes (100% de cobertura)
- **`apps/web`** — scaffolding vitest config pronto (spec 015), testes reais pendentes (spec 017)

> O backend Go (`apps/backend`) tem sua própria suíte de testes via `go test` (ver `make -C apps/backend test`).

### Via Docker Compose (stack completa)

```bash
npm run infra:up   # docker compose up -d --build — sobe floci, aws-init, web, api e nginx
```

A aplicação fica disponível em `http://localhost` (porta 80, via Nginx). As portas `3000` e `3001` também ficam publicadas no host para debug local direto. Em produção, o firewall do servidor deve bloquear acesso externo à porta `3001` — ver [`deploy.md`](deploy.md).