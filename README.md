# Prolink Contábil — WebTool

Monorepo para ferramentas web da Prolink Contábil, incluindo a Ficha de Abertura de Empresa.

## Estrutura do Repositório

Este projeto utiliza **npm workspaces** para gerenciar múltiplos pacotes e aplicações.

- `apps/web`: Frontend Next.js 14+ (App Router) — páginas e formulário, sem acesso direto à AWS
- `apps/api`: Backend Next.js (Route Handlers, sem UI) — sessão, rascunho, upload, submit. Não é exposto publicamente em produção (firewall do servidor bloqueia acesso externo à porta 3001); acessível via Nginx (`/api/*`)
- `apps/worker`: *[Planejado para Fase 7]* Lambda AWS para processamento assíncrono (geração de PDF, envio de e-mails via SES)
- `packages/shared`: Pacote com tipos, constantes e schemas de validação (Zod) compartilhados entre `web`, `api` e `worker`.
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

### Via Docker Compose (stack completa)

```bash
npm run infra:up   # docker compose up -d --build — sobe floci, aws-init, web, api e nginx
```

A aplicação fica disponível em `http://localhost` (porta 80, via Nginx). As portas `3000` e `3001` também ficam publicadas no host para debug local direto. Em produção, o firewall do servidor deve bloquear acesso externo à porta `3001` — ver [`deploy.md`](deploy.md).