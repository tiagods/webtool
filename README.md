# Prolink Contábil — WebTool

Monorepo para ferramentas web da Prolink Contábil, incluindo a Ficha de Abertura de Empresa.

## Estrutura do Repositório

Este projeto utiliza **npm workspaces** para gerenciar múltiplos pacotes e aplicações.

- `apps/web`: Frontend Next.js 14+ (App Router) — páginas e formulário, sem acesso direto à AWS
- `apps/api`: Backend **Go** (Echo + Clean Architecture, monorepo `cmd/api` + `cmd/worker`) — sessão, rascunho, upload, submit. Não é exposto publicamente em produção (firewall do servidor bloqueia acesso externo à porta 3001); acessível via Nginx (`/api/*`). Porta o `apps/api` Node original (specs 022–028)
- `apps/api-node`: *[Legado — removido após verificação em produção]* Implementação Next.js (Route Handlers) anterior, mantida temporariamente para rollback do cutover (spec 028)
- `apps/worker`: *[Planejado para Fase 7]* Container Docker long-running (não Lambda) — consome a fila SQS para processamento assíncrono (geração de PDF, envio de e-mail via SNS→SES). Compartilha o módulo Go de `apps/api` (`cmd/worker`)
- `packages/shared`: Pacote com tipos, constantes e schemas de validação (Zod) compartilhados por `web` e `api-node`; o validador Go de `apps/api` é verificado contra esses schemas por suíte de caracterização.
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
npm run dev -w apps/web   # http://localhost:3000
npm run dev -w apps/api   # http://localhost:3001
```

Em dev, `apps/web/next.config.mjs` tem um `rewrites()` que proxia `/api/:path*` para `http://localhost:3001/api/:path*` — o fluxo completo funciona acessando só `http://localhost:3000`, sem precisar do Nginx.

> **Backend Go (`apps/api-golang`):** exige `JWT_SECRET` no ambiente — **não há fallback no código** (ao contrário do `apps/api` Node). Para rodar localmente sem Docker, copie `.env.example` para `.env` e exporte as variáveis, ou defina `JWT_SECRET` e `APP_ENV` no shell. O `docker-compose.yml` de dev já injeta `${JWT_SECRET:-dev-secret-change-in-production}`, então o fluxo Docker continua funcionando sem configuração.
>
> **Lint do módulo Go:** `make lint` (em `apps/api-golang/`) roda `go vet` + `gofmt` + `golangci-lint`. Instale o linter uma vez com `go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest` (exige `~/go/bin` no PATH) — precisa ser ≥ v2.13 para suportar Go 1.27. Testes de integração contra o Floci: `make test-integration` com a stack `docker compose up -d floci aws-init` de pé.
>
> **Verificação cruzada de JWT (spec 024):** o token `prolink_aceite` assinado pela API Go tem que ser aceito pelo `jose` de `apps/web/middleware.ts`. `TestJWT_CompatibilidadeComJose` (`infrastructure/auth`) cobre isso automaticamente quando `node` está no PATH (pula caso contrário). Para checar um token na mão: `JWT_SECRET=<segredo> node scripts/verify-jwt-cross.mjs <token>`.

### Via Docker Compose (stack completa)

```bash
npm run infra:up   # docker compose up -d --build — sobe floci, aws-init, web, api e nginx
```

A aplicação fica disponível em `http://localhost` (porta 80, via Nginx). As portas `3000` e `3001` também ficam publicadas no host para debug local direto. Em produção, o firewall do servidor deve bloquear acesso externo à porta `3001` — ver [`deploy.md`](deploy.md).