---
id: "014"
title: "Testes E2E com Playwright (simulação de comportamento humano)"
status: draft
created: 2026-07-07
author: "Claude"
batch_size: "medium"
depends_on: ["008", "009"]
---

# Testes E2E com Playwright (simulação de comportamento humano)

## Contexto

O projeto não tem nenhum teste automatizado configurado (`CLAUDE.md`: "There are no test commands configured yet"). Toda validação do fluxo `/abertura` até hoje foi manual — via `curl`/SSR (Spec 008) ou navegador clicado à mão (critério pendente na Spec 010). Isso significa que qualquer regressão no fluxo completo (aceite LGPD → preenchimento → upload → submit → confirmação) só é percebida se alguém testar manualmente, o que não escala e é fácil de pular sob pressão de prazo.

## Objetivo

Introduzir Playwright como framework de testes E2E, dirigindo um navegador real (Chromium) para simular o comportamento de um usuário preenchendo a Ficha de Abertura: clicar, digitar, fazer upload de arquivo, dar refresh na página, navegar entre steps. Os testes rodam contra a stack real (`apps/web` + `apps/api` + Nginx, via `docker-compose.yml` local com Floci) — não contra mocks, para pegar bugs de integração real (cookies, roteamento Nginx, DynamoDB, S3).

Esta spec cobre o primeiro conjunto de testes (fluxo de Abertura); a Ficha de Alteração Contratual (Spec 012) ganha seus próprios testes quando for implementada.

## Fora de escopo

- Pipeline de CI/CD — os testes rodam localmente via comando npm; integrar num pipeline é spec futura.
- Testes do worker Lambda (Spec 013, ainda não implementado).
- Testes da Ficha de Alteração Contratual (Spec 012, ainda não implementado).
- Matriz multi-browser (Firefox/WebKit) — começa só com Chromium; expandir depois se necessário.
- Testes de regressão visual (screenshot diffing).
- Testes de carga/performance.

## Design

### Por que Playwright (e não Cypress)

Suporte nativo a upload de arquivo real via `input[type=file]` (necessário para o step de Documentos), melhor suporte a múltiplas abas/contextos isolados (útil para rodar testes em paralelo sem colidir sessões), e não depende de um browser proprietário embutido. Cypress é comparável, mas Playwright tem integração mais direta com Next.js/Node e já é amplamente adotado — não há motivo para o time aprender uma ferramenta pior.

### Onde os testes rodam

Contra a stack subida via `docker compose up -d --build` (dev, com Floci) — `http://localhost` (Nginx), não contra `localhost:3000` isolado, para exercitar o roteamento real (`/` → web, `/api/*` → api) que existe em produção. Isso significa que os testes exigem Docker rodando localmente; não há tentativa de mockar AWS via Jest/mocks — a intenção é testar o sistema real, incluindo Floci.

### Isolamento entre execuções

Floci mantém estado entre execuções do `docker compose up` (a menos que os volumes sejam recriados). Para evitar testes colidindo com dados de execuções anteriores (ex: sessão anterior ainda com cookie válido), cada teste:
- Usa um contexto de navegador Playwright isolado (sem cookies compartilhados entre testes).
- Gera dados de teste únicos por execução (CNPJ, e-mail, nomes com sufixo aleatório/timestamp) — não depende de limpar o Floci entre execuções.

### Estrutura de arquivos

```
webtool/
├── e2e/
│   ├── fixtures/
│   │   └── documento-teste.pdf      ← PDF pequeno versionado, usado nos uploads
│   ├── abertura-fluxo-completo.spec.ts
│   ├── abertura-restauracao-rascunho.spec.ts
│   └── abertura-slu.spec.ts
├── playwright.config.ts             ← raiz do monorepo, baseURL http://localhost
└── package.json                     ← script "test:e2e": "playwright test"
```

Playwright como devDependency na raiz do monorepo (não um workspace novo) — os testes não fazem parte do código de produção de nenhum app, só o exercitam de fora.

### Casos de teste

| Teste | Cobre |
|---|---|
| `abertura-fluxo-completo.spec.ts` | Aceite LGPD → 5 passos (Ltda) preenchidos → upload real de arquivo → submit → assert `/abertura/confirmacao` exibe protocolo |
| `abertura-restauracao-rascunho.spec.ts` | Preenche parcialmente → refresh (F5) → assert dados restaurados automaticamente — **automatiza o critério manual pendente na Spec 010** |
| `abertura-slu.spec.ts` | Fluxo com `tipoSociedade = SLU` (sócio único) → assert que o step Sociedade (exclusivo Ltda) é pulado |

### Camadas afetadas

| Camada | Arquivo | Ação |
|--------|---------|------|
| Config | `playwright.config.ts` | CREATE |
| Testes | `e2e/*.spec.ts` | CREATE |
| Fixture | `e2e/fixtures/documento-teste.pdf` | CREATE |
| Root | `package.json` | MODIFY — adiciona `@playwright/test` como devDependency e script `test:e2e` |
| Docs | `README.md` | MODIFY — seção de como rodar os testes E2E localmente (pré-requisito: `docker compose up -d --build` rodando) |

## Critérios de aceite

- [ ] `@playwright/test` instalado como devDependency raiz, `playwright.config.ts` configurado com `baseURL: http://localhost`
- [ ] `npm run test:e2e` executa a suíte contra a stack Docker local (assume `docker compose up` já rodando — não sobe a stack automaticamente)
- [ ] Teste do fluxo completo de Abertura (Ltda) passando: aceite → preenchimento → upload → submit → confirmação com protocolo
- [ ] Teste de restauração de rascunho passando: preenchimento parcial → refresh → dados restaurados
- [ ] Teste do fluxo SLU passando: step Sociedade corretamente ausente
- [ ] Dados de teste únicos por execução (sem colisão em execuções consecutivas contra o mesmo Floci)
- [ ] `README.md` documenta pré-requisitos e comando para rodar os testes localmente
- [ ] `npm run lint` passando (incluindo os arquivos `e2e/*.spec.ts`)

## Notas

- Este trabalho automatiza diretamente o critério de "validação manual em navegador real" deixado em aberto na Spec 010 (`/abertura` → `/abertura/confirmacao`) — depois desta spec, aquele critério pode ser satisfeito rodando `npm run test:e2e` em vez de clique manual.
- Decisão de rodar contra Docker/Floci real (não mocks): o valor de um teste "E2E" vem de exercitar a integração real (cookies via Nginx, TTL do DynamoDB, presigned URL do S3) — mockar essas peças reduziria o teste a algo equivalente a um teste de componente, que já teria menos custo de manutenção sem essa infraestrutura.
- CI fica fora de escopo por não existir pipeline ainda no projeto — pode virar spec própria quando o time decidir a ferramenta (GitHub Actions, etc.).
