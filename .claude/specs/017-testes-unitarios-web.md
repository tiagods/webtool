---
id: "017"
title: "Testes Unitários — apps/web (Meta 100% / Piso 95%)"
status: in-progress
created: 2026-07-07
author: "Claude"
batch_size: "medium"
depends_on: ["015"]
---

# Testes Unitários — apps/web (Meta 100% / Piso 95%)

## Contexto

A Spec 015 configura o framework de testes unitários (Vitest) e a régua de cobertura (100% de meta, 95% de piso por arquivo) para os três workspaces, mas só entrega `packages/shared` totalmente coberto — `apps/web` fica só com scaffolding (`vitest.config.ts` com `environment: jsdom`, zero testes). `apps/web` concentra toda a UI do formulário multi-step: `StepperEngine.tsx` (orquestração de estado, navegação, persistência de rascunho), os componentes de step (`StepDadosEmpresa`, `StepEndereco`, `StepSocios`, `StepSociedade`, `StepDocumentos`, `StepRevisao`), `middleware.ts` (decide o banner LGPD), e `lib/viacep.ts`. Hoje só a Spec 014 (E2E, lenta, só caminho feliz) e a Spec 016 (que cobre `apps/api`, não `apps/web`) tocam esse código — nenhuma rede de segurança rápida para regressões de UI (ex.: campo condicional que some quando não deveria, validação que não dispara, step que não avança).

## Objetivo

Escrever testes de componente para todo `apps/web` usando `@testing-library/react` (já escopado como devDependency na Spec 015) sobre `jsdom`, atingindo 100% de cobertura por arquivo (piso 95%, com justificativa registrada para qualquer arquivo que não feche em 100% — mesma régua da Spec 015/016). Cobre: componentes de step, `StepperEngine`, componentes utilitários (`Stepper`, `UploadField`, `RadioCard`, `RadioChip`), `middleware.ts` e `lib/viacep.ts`.

## Fora de escopo

- Testes E2E reais em navegador (já cobertos pela Spec 014).
- Testes de acessibilidade automatizados (axe-core) — pode virar spec própria se o time quiser.
- Testes de regressão visual (screenshot diffing).
- Qualquer refactor de componente além do mínimo necessário para testabilidade.

## Design

### Testando comportamento, não implementação

Seguindo a prática padrão do Testing Library: queries por `role`/`label`/texto visível (`getByRole('textbox', { name: /razão social/i })`), nunca por classe CSS ou estrutura de DOM interna — testes continuam válidos mesmo se o Tailwind/markup mudar, só quebram se o comportamento observável pelo usuário mudar.

### Mock de rede: MSW (Mock Service Worker)

`StepperEngine.tsx` chama `/api/draft`, `/api/session`, `/api/upload-url`, `/api/submit` via `fetch`. Em vez de mockar `fetch` manualmente em cada teste (frágil, repetitivo), usar MSW para interceptar essas chamadas no nível de rede — os testes descrevem a resposta esperada por rota, mais próximo do comportamento real do browser do que um mock de função.

### `StepperEngine` — o componente mais complexo

Cobre, com MSW simulando as respostas do backend:
- Navegação entre steps (avançar só com validação Zod passando, voltar sem perder dados).
- Diferença de fluxo Ltda (6 steps, inclui `StepSociedade`) vs. SLU (5 steps, sem `StepSociedade`).
- Persistência de rascunho: chamada a `POST /api/draft` disparada nos pontos certos (ex.: ao avançar de step), sem duplicar chamadas.
- Restauração de rascunho no mount: `GET /api/draft` retorna payload existente → formulário é populado (`methods.reset`) — versão de unidade/mock do mesmo comportamento que a Spec 014 valida em E2E real e a Spec 010 pedia para validar manualmente.
- Submit final: `POST /api/submit` disparado só na última etapa, com todos os dados; redirecionamento para `/abertura/confirmacao?protocolo=...` no sucesso.

### Componentes de step

Cada `Step*.tsx` testado isoladamente (sem montar o `StepperEngine` inteiro): campos obrigatórios exibindo erro quando vazios, máscaras `react-imask` formatando corretamente (CPF `000.000.000-00`, CNPJ, CEP `00000-000`, telefone), campos condicionais aparecendo/desaparecendo conforme resposta anterior (ex.: `StepSocios` — campo de CNPJ anterior só aparece se "participação em outra empresa" = sim), e a integração com `lib/viacep.ts` em `StepEndereco` (busca automática de endereço a partir do CEP, com MSW mockando a resposta do ViaCEP).

### `middleware.ts`

Next.js Middleware roda em Edge Runtime como uma função exportada que recebe `NextRequest` — testável do mesmo jeito que os Route Handlers da Spec 016 (chamada direta, sem servidor real): com/sem cookie `prolink_aceite` válido, decidindo se redireciona para o banner ou deixa passar.

### Camadas afetadas

| Camada | Arquivo | Ação |
|--------|---------|------|
| Root | `package.json` | MODIFY — devDependencies `msw`, `@testing-library/user-event` |
| Config | `apps/web/package.json` | MODIFY — scripts `test` e `test:coverage` |
| Config | `apps/web/vitest.config.ts` | MODIFY — alias `@/*`, `setupFiles`, incluir `middleware.ts` no `test.include`/`coverage.include` |
| Setup | `apps/web/vitest.setup.ts` | CREATE — `@testing-library/jest-dom`, ciclo do MSW, shims Radix/`ResizeObserver` |
| Mocks | `apps/web/mocks/server.ts` + `apps/web/mocks/handlers.ts` | CREATE — MSW para `/api/*` e ViaCEP |
| Testes | `apps/web/app/abertura/StepperEngine.test.tsx` | CREATE |
| Testes | `apps/web/app/alteracao/StepperEngine.test.tsx` | CREATE |
| Testes | `apps/web/middleware.test.ts` | CREATE |
| Testes | `apps/web/components/forms/Step*.test.tsx` (6) | CREATE |
| Testes | `apps/web/components/forms-alteracao/Step*.test.tsx` (4) + `quadros/Q0*.test.tsx` (9) | CREATE |
| Testes | `apps/web/components/{Stepper,StepperAlteracao,UploadField,RadioCard,RadioChip,TermoCienciaModal,SelecaoFichaCard}.test.tsx` | CREATE |
| Testes | `apps/web/components/ui/*.test.tsx` | CREATE |
| Testes | `apps/web/lib/*.test.ts` (`viacep`, `masks`, `uf`, `termo`, `utils`) | CREATE |

## Critérios de aceite

- [ ] MSW configurado como interceptador de rede nos testes (`setupFiles` do Vitest) — nenhum teste depende de `fetch` real ou de `apps/api`/Docker rodando
- [ ] Todos os arquivos listados em "Camadas afetadas" com testes atingindo 100% de cobertura individual (piso 95% — qualquer arquivo abaixo de 100% tem a lacuna justificada em uma frase, mesma régua da Spec 015/016)
- [ ] `StepperEngine`: navegação Ltda (6 steps) e SLU (5 steps) testadas separadamente; persistência e restauração de rascunho cobertas com MSW mockando `/api/draft`
- [ ] Componentes de step: cada campo obrigatório, cada máscara (`react-imask`) e cada campo condicional testados
- [ ] `middleware.ts`: ambos os ramos (com/sem `prolink_aceite` válido) cobertos
- [ ] `npm run test:coverage -w apps/web` passa o gate de 95%
- [ ] `npm run lint` passando

## Notas

- Depende da Spec 015 estar `done` (scaffolding do Vitest com `jsdom` em `apps/web/vitest.config.ts` já criado lá).
- O teste de restauração de rascunho aqui é **a nível de componente/mock** (MSW simulando a resposta de `/api/draft`) — não substitui o teste E2E real da Spec 014 nem a validação manual da Spec 010, mas dá feedback muito mais rápido durante o desenvolvimento; os três níveis (unitário, E2E, manual) se complementam, não são redundantes.
- Se algum componente hoje estiver acoplado demais para testar isoladamente (ex.: lógica de validação misturada com JSX de um jeito que dificulta mockar), extrair a lógica pura para um hook/função separada é parte do escopo desta spec — mudança de testabilidade, não de comportamento.
- **Nota de execução (batch)**: o `coverage.include` do workspace cobre **todo** `app/`, `components/` e `lib/`, então o gate de 95% por arquivo exige cobrir também o fluxo `alteracao` (`app/alteracao/StepperEngine.tsx`, `components/forms-alteracao/**`, `Q01–Q09`), `components/ui/**`, `StepperAlteracao`, `TermoCienciaModal`, `SelecaoFichaCard` e `lib/{masks,uf,termo,utils}` — todos incluídos na tabela acima. `quadros.config.ts` fica excluído pelo glob `**/*.config.*` do `vitest.shared.ts`. `apps/web/middleware.ts` está na raiz do app, não em `app/`, por isso precisa ser adicionado explicitamente ao `test.include`/`coverage.include`.
- **Nota de execução (infra)**: os scripts `test`/`test:coverage` não existiam em `apps/web/package.json`; o alias `@/*` do `tsconfig.json` não era resolvido pelo Vitest; e `@testing-library/jest-dom` estava instalado mas sem `setupFiles`. Tudo isso é pré-requisito desta spec e entra nas "Camadas afetadas".
