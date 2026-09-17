---
id: "015"
title: "Testes Unitários — Framework, Meta 100% / Piso 95% de Cobertura por Arquivo"
status: draft
created: 2026-07-07
updated: 2026-09-16
author: "Claude"
batch_size: "medium"
depends_on: []
---

> **ATUALIZAÇÃO 2026-09-16 — adaptação ao cutover Go (specs 022–029).** O workspace `apps/api`
> (Next.js) foi substituído por `apps/backend` (Go, specs 022–028). O Go já tem seu próprio
> ecossistema de testes (`go test`) e a suíte de caracterização para paridade Zod ↔ Go. Esta spec
> passa a cobrir **apenas** os workspaces npm que restaram: `packages/shared` + `apps/web`. A
> cobertura do backend Go é tratada separadamente via `go test -cover` (ver `apps/backend/Makefile`).

# Testes Unitários — Framework, Meta 100% / Piso 95% de Cobertura por Arquivo

## Contexto

O projeto não tem nenhum teste unitário configurado nos workspaces npm (`CLAUDE.md`:
"apps/web has no test command yet"). A Spec 014 cobre testes E2E (fluxo completo pelo navegador),
mas E2E só exercita o caminho feliz — não cobre casos de borda como CNPJ malformado, `estadoCivil`
inválido, regras de `.refine()`/`.superRefine()` dos schemas Zod. Essa lógica hoje não tem nenhuma
rede de segurança contra regressão: um bug já real (`lessons.md`, 2026-07-02) foi justamente um
schema Zod perdendo `.partial()` depois de `.superRefine()` — o tipo de erro que um teste unitário
simples teria pego antes de chegar em produção.

> O backend Go (`apps/backend`) já tem testes configurados (`make -C apps/backend test` roda
> `go test ./... -race`) — **não é alvo desta spec.** A suíte de caracterização
> (`scripts/gen-abertura-characterization.mjs` / `gen-alteracao-characterization.mjs`) já cobre
> a paridade entre os validadores Go e os schemas Zod. O foco aqui são os workspaces npm que
> **não** têm testes ainda.

## Objetivo

Configurar um framework de testes unitários nos **dois** workspaces npm do monorepo
(`packages/shared` e `apps/web`) com **100% de cobertura por arquivo como meta e 95% como piso
obrigatório** (statements/branches/functions/lines — não só média do projeto, cada arquivo
individualmente). O gate mecânico (comando de teste falhando com exit code ≠ 0) fica em 95% — é o
que a ferramenta consegue impor automaticamente. Os 5 pontos percentuais entre 95% e 100%, quando
não fechados, exigem justificativa explícita por arquivo (não é aceitável parar em 95% por economia
de esforço quando 100% é alcançável).

Como primeiro incremento dentro desta spec, escrever a suíte completa para `packages/shared`
(schemas Zod + constantes) — é o pacote mais isolado (sem I/O, sem mocks de rede/AWS necessários),
o de maior retorno (usado por `apps/web` e pelo validador Go em `apps/backend` simultaneamente) e o
que já teve um bug real de regra Zod não coberta.

## Fora de escopo

- Cobertura de 95% em `apps/web` — volume grande demais para um batch "medium"; vira spec de continuação (`017`) reaproveitando a configuração criada aqui.
- Testes do backend Go (`apps/backend`) — já tem sua própria suíte via `go test` e `make -C apps/backend test`.
- Testes E2E (já cobertos pela Spec 014).
- Integração em pipeline de CI — não existe pipeline ainda no projeto.
- Testes de mutação (mutation testing).
- Testes de snapshot visual de componentes React.

## Design

### Por que Vitest (não Jest)

- TypeScript/ESM nativo via esbuild — sem configuração de Babel/`ts-jest` para reconciliar com os três `tsconfig.json` que já estendem `tsconfig.base.json`.
- Suporte nativo a **workspaces** (`vitest.workspace.ts`), que mapeia 1:1 para os workspaces npm já existentes (`apps/web`, `packages/shared`) — cada um roda com seu próprio `environment` (jsdom para `apps/web`, node para `packages/shared`) sob um único comando na raiz.
- Cobertura via `@vitest/coverage-v8` suporta `coverage.thresholds.perFile: true` nativamente — exatamente o requisito de "95% em cada arquivo", sem precisar de script customizado para parsear o relatório.
- Mais rápido em watch mode (importante já que o objetivo é rodar teste com frequência durante o desenvolvimento, não só antes de commit).

### Estrutura

```
webtool/
├── vitest.workspace.ts          ← raiz: referencia os 2 configs abaixo
├── vitest.shared.ts             ← config-base compartilhada (thresholds, coverage exclude)
├── packages/shared/
│   ├── vitest.config.ts         ← environment: node
│   └── src/schemas/
│       ├── abertura.test.ts
│       ├── aceite.test.ts
│       └── documentos.test.ts
└── apps/web/
    └── vitest.config.ts         ← environment: jsdom, setup com @testing-library/jest-dom (sem testes nesta spec, só scaffolding)
```

`vitest.shared.ts` centraliza o threshold para não duplicar `95` em três arquivos:

```ts
// vitest.shared.ts
export const coverageThresholds = {
  perFile: true,
  statements: 95,
  branches: 95,
  functions: 95,
  lines: 95,
} as const;
```

### 100% como meta, 95% como piso — como isso é aplicado na prática

O `coverage.thresholds` do Vitest só sabe fazer um corte mecânico (passa/falha); ele vira o **piso** (95%). A meta de 100% não é algo que a ferramenta imponha sozinha — é um padrão de processo:

- Ao final de cada arquivo de teste, rodar `vitest run --coverage` e olhar o relatório por arquivo antes de considerar o teste pronto.
- Se um arquivo fechar em 100%, ótimo, segue.
- Se um arquivo ficar entre 95% e 99%, a linha/branch não coberta precisa de uma justificativa de uma frase no PR/resumo do batch (ex.: "branch de erro do AWS SDK que só ocorre em falha de rede, não reproduzível em teste unitário sem mock excessivamente artificial") — não é aceitável deixar sem explicação.
- Se um arquivo ficaria abaixo de 95%, o arquivo (ou a função específica) precisa ser refatorado para ser testável, ou a lógica não-testável extraída/isolada — 95% é o piso não-negociável, não um alvo.

### O que "cada arquivo" exclui (decisão a validar com o usuário)

### O que "cada arquivo" exclui (decisão a validar com o usuário)

95% por arquivo aplicado literalmente a todo o repositório incluiria arquivos sem lógica (`layout.tsx`, `page.tsx` de rota, `next.config.mjs`, arquivos `*.d.ts`, barrels `index.ts` de puro re-export). Proposta de exclusão via `coverage.exclude` no config compartilhado:

```ts
exclude: [
  '**/*.d.ts',
  '**/*.config.{ts,js,mjs}',
  '**/layout.tsx',        // boilerplate Next.js sem lógica de branch
  '**/index.ts',          // barrels de puro re-export
  '**/*.test.ts',
]
```

Esta lista fica explícita no config (não escondida) para ser fácil de revisar/contestar arquivo a arquivo depois.

### Plano de testes — `packages/shared` (escopo desta spec)

| Arquivo | Casos a cobrir |
|---|---|
| `schemas/abertura.ts` | Payload válido completo (Ltda e SLU); cada campo obrigatório ausente/inválido isoladamente; regras de `.superRefine()` (ex.: campos condicionais por `tipoSociedade`); `aberturaFormObjectSchema` vs `aberturaFormDraftSchema` (`.partial()` funcionando pós-refactor do bug de 2026-07-02) |
| `schemas/aceite.ts` | Payload válido; versão de termo ausente/inválida |
| `schemas/documentos.ts` | Campo de upload válido/inválido; regex de nome de campo (`/^[a-z0-9_]{1,80}$/`, mencionado em `docs/aws.md`) |
| `constants/termo.ts` | Se for só uma constante sem lógica, provável candidato a exclusão — decidir durante a implementação se há branch a testar |

### Camadas afetadas

| Camada | Arquivo | Ação |
|--------|---------|------|
| Config raiz | `vitest.workspace.ts` | CREATE |
| Config raiz | `vitest.shared.ts` | CREATE |
| Config | `packages/shared/vitest.config.ts` | CREATE |
| Config | `apps/web/vitest.config.ts` | CREATE (scaffolding, sem testes nesta spec) |
| Testes | `packages/shared/src/schemas/*.test.ts` | CREATE |
| Root | `package.json` | MODIFY — devDependencies (`vitest`, `@vitest/coverage-v8`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`) + scripts `test`, `test:coverage` |
| Docs | `README.md` | MODIFY — como rodar os testes e o relatório de cobertura |

## Critérios de aceite

- [ ] `vitest.workspace.ts` configurado referenciando os **2** workspaces npm (`packages/shared`, `apps/web`); `npm run test` roda a suíte completa a partir da raiz
- [ ] `npm run test:coverage` gera relatório de cobertura com `thresholds.perFile: true` em 95% (statements/branches/functions/lines) — comando falha (exit ≠ 0) se qualquer arquivo não excluído ficar abaixo do threshold (piso mecânico)
- [ ] Lista de exclusões de cobertura (`coverage.exclude`) revisada e aprovada pelo usuário — não é uma decisão unilateral do agente
- [ ] `packages/shared`: todos os arquivos de `src/schemas/` com testes atingindo **100% de cobertura individual**, incluindo casos de payload inválido por campo e as regras de `.refine()`/`.superRefine()`
- [ ] Qualquer arquivo de `packages/shared` que fechar abaixo de 100% (mas ≥95%) tem a linha/branch não coberta identificada e justificada em uma frase no resumo do batch — nenhum arquivo fica entre 95–99% sem explicação registrada
- [ ] `apps/web`: scaffolding de config presente e funcional (`vitest run` executa sem erro, mesmo com zero testes), mas cobertura de 95% fica para a spec `017`
- [ ] `README.md` documenta o comando de teste e como interpretar o relatório de cobertura
- [ ] `npm run lint` passando (incluindo os arquivos `*.test.ts`)

## Notas

- **Risco de escopo**: aplicar 95%/arquivo a `apps/web` (componentes React com muito JSX condicional) é um volume de trabalho real — merece sua própria spec (`017-testes-unitarios-web.md`) para respeitar a regra de Small Batches (`.claude/CLAUDE.md`: "uma spec = máximo 1 dia de trabalho"). Esta spec só entrega `packages/shared` 100% coberto, mas deixa a configuração pronta para `apps/web` reaproveitar sem retrabalho.
- O backend Go (`apps/backend`) já tem testes configurados (`go test`) — não entra no escopo Vitest.
- Threshold de 95% "por arquivo" (piso) já é mais rígido que a prática comum (a maioria dos projetos usa média do projeto); a meta real é 100%, com 95% servindo só de rede de segurança mecânica. Vale revisitar caso a caso (não abaixando o piso global) se algum arquivo legítimo se mostrar impraticável de cobrir 100% — ex.: branch de erro de SDK que só ocorre em cenário de rede real, não reproduzível sem mock artificial demais.
- Essa meta 100%/piso 95% se aplica igualmente à spec de continuação (`017-testes-unitarios-web.md`) quando for criada — não é uma regra exclusiva de `packages/shared`.
