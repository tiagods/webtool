# Agente: Test Setup — apps/web (Scaffolding Vitest)

## Missão

Criar o scaffolding de testes unitários (Vitest) para o workspace `apps/web`. Nesta spec (015),
apenas o config é criado — os testes reais dos componentes serão implementados na spec 017.

## Escopo

### Arquivos a CRIAR

| Arquivo | Descrição |
|---------|-----------|
| `apps/web/vitest.config.ts` | Config Vitest para `apps/web` (environment: jsdom, setup com `@testing-library/jest-dom`) |

### Dependências (já adicionadas no root package.json pela parte shared)

- `vitest`
- `@vitest/coverage-v8`
- `@testing-library/react`
- `@testing-library/jest-dom`
- `jsdom`

### Verificação

- `vitest run` executa sem erro (mesmo com zero testes)
- `vitest run --coverage` gera relatório (sem thresholds ativos para web nesta spec)
- O config com `environment: jsdom` permite testar componentes React no futuro (spec 017)

### Estrutura esperada

```ts
// apps/web/vitest.config.ts
import { defineConfig } from 'vitest/config';
import { coverageThresholds } from '../../vitest.shared';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    coverage: {
      ...coverageThresholds,
      provider: 'v8',
    },
  },
});
```