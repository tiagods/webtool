---
id: "036"
title: "Corrigir testes unitários quebrados em packages/shared e apps/web"
status: done
created: 2026-09-27
author: "Tiago"
batch_size: "small"
depends_on: []
prefer_after: []
touches:
  - "packages/shared/src/schemas/abertura.ts"
  - "packages/shared/src/schemas/abertura.test.ts"
  - "apps/web/components/forms/StepEndereco.tsx"
  - "apps/web/components/forms/StepEndereco.test.tsx"
  - "apps/web/components/forms/StepSocios.tsx"
  - "apps/web/components/forms/StepSocios.test.tsx"
  - "apps/web/components/forms/StepDocumentos.test.tsx"
  - "apps/web/components/forms/StepRevisao.test.tsx"
---

# Corrigir testes unitários quebrados em packages/shared e apps/web

## Contexto

`npm run test` (vitest) está com **23 testes falhando em 5 arquivos** (de 307 testes, 48
arquivos) na `main`, sem relação com a spec 035 (SMTP) nem com o e2e do Playwright —
confirmado que nenhuma dessas falhas foi introduzida nesta sessão (`git status` limpo em
`apps/web` e `packages/shared` antes de qualquer investigação). `make -C apps/backend test`
(Go) está **verde**.

Duas causas aparentes, ainda não totalmente diagnosticadas:

1. **Drift de tipo em `imovelAlugado`**: `packages/shared/src/schemas/abertura.test.ts`
   (11 falhas) envia `imovelAlugado: true/false` (boolean) mas o schema Zod atual espera o
   enum `'sim' | 'nao'` (`invalid_type` do Zod). `StepEndereco.test.tsx` (1 falha) espera
   `true` onde o form já produz `'sim'` — mesmo drift, lado componente.
2. **Drift de locators/placeholders** em `StepSocios.test.tsx` (3 falhas: máscaras de
   CPF/PIS/celular, preenchimento de CEP do sócio, erro do ViaCEP) — `getByPlaceholderText`
   não encontra elementos, sugerindo que os placeholders do componente mudaram e o teste não
   acompanhou.
3. `StepDocumentos.test.tsx` (4 falhas) e `StepRevisao.test.tsx` (2 falhas) — causa raiz não
   investigada nesta sessão; podem compartilhar a causa 1 (fixtures que incluem
   `imovelAlugado`) ou ser um terceiro drift.

## Objetivo

Investigar a causa raiz de cada um dos 5 arquivos de teste falhando e decidir, por caso: se
o teste está desatualizado (ajustar o teste) ou se o componente/schema tem um bug real
(ajustar o código). Voltar `npm run test` para verde.

## Fora de escopo

- Testes E2E (Playwright) — falha separada e conhecida (`RadioCard` não expõe `role="button"`
  em `apps/web/components/RadioCard.tsx`, usado por `StepDadosEmpresa.tsx`); tratar em spec
  própria se/quando decidido.
- Qualquer mudança em `apps/backend` (spec 035, já concluída e verificada nesta sessão).

## Design

> A investigar durante o batch — este spec starta em `draft` porque a causa raiz exata dos
> itens 2 e 3 do Contexto ainda não foi confirmada. Primeira tarefa do batch é rodar
> `npx vitest run --reporter=verbose` por arquivo e classificar cada falha antes de editar
> qualquer código.

### Camadas afetadas

| Camada | Arquivo | Ação |
|--------|---------|------|
| Shared | `packages/shared/src/schemas/abertura.ts` / `.test.ts` | INVESTIGAR — decidir schema vs. teste |
| Web | `apps/web/components/forms/StepEndereco.tsx` / `.test.tsx` | INVESTIGAR — mesmo drift `imovelAlugado` |
| Web | `apps/web/components/forms/StepSocios.tsx` / `.test.tsx` | INVESTIGAR — placeholders/locators |
| Web | `apps/web/components/forms/StepDocumentos.test.tsx` | INVESTIGAR — causa não diagnosticada |
| Web | `apps/web/components/forms/StepRevisao.test.tsx` | INVESTIGAR — causa não diagnosticada |

## Critérios de aceite

- [ ] Causa raiz de cada um dos 5 arquivos documentada (schema desatualizado, teste
  desatualizado, ou bug real) antes de qualquer edição.
- [ ] `npm run test` verde (307/307).
- [ ] Nenhuma mudança de comportamento do formulário sem justificativa registrada nesta spec.
- [ ] Gates do escopo tocado verdes: `apps/web/**`, `packages/**` → `npm run lint` +
  `npm run build` + `npm run test`.

## Notas

- Descoberto durante a investigação do e2e (spec relacionada: infra Docker/SMTP da spec 035
  estava com imagens desatualizadas — já corrigido e fora do escopo desta spec).
- Sequencial — arquivos pequenos, causa raiz ainda incerta, não vale paralelizar.
