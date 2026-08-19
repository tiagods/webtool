---
id: "001"
title: "Setup Monorepo + Design System"
status: done
created: 2026-04-12
author: "Claude"
batch_size: "small"
depends_on: []
---

# Setup Monorepo + Design System

## Contexto

> O projeto Prolink Contábil WebTool precisa ser inicializado do zero como um **monorepo TypeScript**. Hoje existe apenas `docs/` com specs e um protótipo no Paper Design com 6 artboards. A estrutura monorepo permitirá abrigar o frontend (Next.js), o worker Lambda (Node.js) e pacotes compartilhados (schemas Zod, tipos) em um único repositório.

## Objetivo

> Criar a estrutura monorepo com npm workspaces, inicializar o projeto Next.js em `apps/web/`, criar o pacote `packages/shared/`, configurar o design system (cores, fontes, tokens) no Tailwind, e instalar os componentes shadcn/ui necessários. Ao final, `npm run dev` na raiz deve iniciar o frontend.

## Fora de escopo

- `apps/worker/` — será criado na Fase 6
- Desenvolvimento de telas/formulários (Fase 2)
- Validações Zod e React Hook Form (Fase 3)
- Integrações ViaCEP, máscaras (Fase 4)
- Upload de documentos (Fase 5)
- Backend/APIs (Fase 6)

## Design

### Estrutura do monorepo

```
webtool/
├── .claude/                  # Regras do agente (já existe)
├── docs/                     # Documentação (já existe)
├── fichas/                   # Word originais (já existe)
├── apps/
│   └── web/                  # Next.js 14+ (App Router)
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx
│       │   └── globals.css
│       ├── components/
│       │   └── ui/           # shadcn/ui components
│       ├── lib/
│       │   └── utils.ts      # cn() helper
│       ├── package.json
│       ├── tailwind.config.ts
│       ├── tsconfig.json     # extends ../../tsconfig.base.json
│       └── next.config.ts
├── packages/
│   └── shared/               # Tipos, schemas Zod, constantes
│       ├── src/
│       │   └── index.ts
│       ├── package.json      # name: "@prolink/shared"
│       └── tsconfig.json     # extends ../../tsconfig.base.json
├── package.json              # root — workspaces config
├── tsconfig.base.json        # TypeScript base compartilhado
└── README.md
```

### Arquivos criados/modificados

| Camada | Arquivo | Ação |
|--------|---------|------|
| Root | `package.json` | CREATE — workspaces: ["apps/*", "packages/*"] |
| Root | `tsconfig.base.json` | CREATE — config TS base compartilhada |
| Web | `apps/web/*` | CREATE (via `create-next-app`) |
| Web | `apps/web/tailwind.config.ts` | MODIFY — cores do design system |
| Web | `apps/web/app/globals.css` | MODIFY — tokens CSS, overrides |
| Web | `apps/web/app/layout.tsx` | MODIFY — fonte Inter, metadata |
| Web | `apps/web/app/page.tsx` | MODIFY — placeholder |
| Web | `apps/web/tsconfig.json` | MODIFY — extends base |
| Web | `apps/web/components/ui/*` | CREATE (via `npx shadcn`) |
| Shared | `packages/shared/package.json` | CREATE — @prolink/shared |
| Shared | `packages/shared/tsconfig.json` | CREATE — extends base |
| Shared | `packages/shared/src/index.ts` | CREATE — barrel export |

### Cores do Design System

```ts
colors: {
  brand: '#05354C',      // Azul escuro Prolink
  accent: '#0099FF',     // Azul primário/CTA
  sky: '#6CBCDA',        // Azul claro
  success: '#16a34a',    // Verde
  error: '#DC2626',      // Vermelho
  text: '#1C1C1C',       // Texto principal
  textAlt: '#28282B',    // Texto alternativo
  muted: '#999999',      // Texto secundário
  border: '#E5E5E8',     // Borders
  surface: '#FFFFFF',    // Background cards
  surfaceAlt: '#F9F9F9', // Background página
  warm: '#FCFCFA',       // Background inputs
}
```

### Dependências

**Root** (`package.json`):
- npm workspaces config only

**`apps/web`**:
```
# Core (via create-next-app)
next, react, react-dom, typescript, tailwindcss

# Formulários (instalar agora, usar na Fase 3)
react-hook-form, zod, @hookform/resolvers

# Máscaras (instalar agora, usar na Fase 4)
react-imask

# Sessão (instalar agora, usar na Fase 6)
jose

# UI (via npx shadcn)
input, textarea, label, select, checkbox, button, tabs
```

**`packages/shared`**:
```
# Dependências mínimas
zod, typescript
```

### Comandos do monorepo

```bash
# Dev (roda o Next.js)
npm run dev -w apps/web

# Atalho na raiz
# package.json root: "scripts": { "dev": "npm run dev -w apps/web" }

# Lint
npm run lint -w apps/web

# Build
npm run build -w apps/web
```

## Critérios de aceite

- [x] Estrutura monorepo criada (`apps/web`, `packages/shared`)
- [x] npm workspaces funcionando (`npm install` na raiz instala tudo)
- [x] `npm run dev` na raiz inicia o Next.js sem erros
- [x] `apps/web/tsconfig.json` extends `tsconfig.base.json`
- [x] Tailwind configurado com todas as cores do design system
- [x] Fonte Inter carregada via `next/font/google`
- [x] Componentes shadcn/ui instalados (input, textarea, label, select, checkbox, button, tabs)
- [x] `globals.css` com tokens CSS customizados
- [x] `@prolink/shared` importável de `apps/web`
- [x] TypeScript compilando sem erros
- [x] ESLint passando

## Notas

> - As cores foram extraídas do site prolinkcontabil.com.br e do protótipo Paper Design
> - O worker (`apps/worker/`) será criado na Fase 6 — por ora só monta a estrutura monorepo
> - `packages/shared` começa vazio, será populado com schemas Zod na Fase 3
> - Referências: [docs/design-system.md](../../docs/design-system.md), [docs/arquitetura.md](../../docs/arquitetura.md)
