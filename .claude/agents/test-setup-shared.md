# Agente: Test Setup — packages/shared (Schemas Zod)

## Missão

Configurar a infraestrutura de testes unitários (Vitest) para o workspace `packages/shared` e escrever a suíte completa de testes para todos os schemas Zod.

## Escopo

### Arquivos a CRIAR

| Arquivo | Descrição |
|---------|-----------|
| `vitest.workspace.ts` (raiz) | Workspace config referenciando `packages/shared` e `apps/web` |
| `vitest.shared.ts` (raiz) | Config-base compartilhada (thresholds 95% perFile, coverage exclude) |
| `packages/shared/vitest.config.ts` | Config Vitest para `packages/shared` (environment: node) |
| `packages/shared/src/schemas/abertura.test.ts` | Testes do schema de abertura |
| `packages/shared/src/schemas/aceite.test.ts` | Testes do schema de aceite |
| `packages/shared/src/schemas/documentos.test.ts` | Testes do schema de documentos |
| `packages/shared/src/schemas/alteracao.test.ts` | Testes do schema de alteração |
| `packages/shared/src/constants/termo.test.ts` | Testes da constante termo |

### Arquivos a MODIFICAR

| Arquivo | Ação |
|---------|------|
| `package.json` (raiz) | Adicionar devDependencies (`vitest`, `@vitest/coverage-v8`) + scripts `test`, `test:coverage` |
| `README.md` (raiz) | Adicionar seção de como rodar testes |

### Schemas a testar (cobertura 100%)

1. **`abertura.ts`** — `stepDadosEmpresaSchema`, `stepEnderecoSchema`, `socioSchema`, `stepSociosSchema`, `quotaSocioSchema`, `stepSociedadeSchema`, `aberturaFormObjectSchema`, `aberturaFormSchema` (com `.superRefine()`), `aberturaFormDraftSchema`
   - Payload válido completo (Ltda e SLU)
   - Cada campo obrigatório ausente/inválido isoladamente
   - Regras de `.superRefine()` (mínimo 2 sócios para Ltda, CNPJ anterior quando `teveParticipacaoSocietaria`, soma quotas = 100%, pelo menos 1 admin, quotas = número de sócios)
   - `aberturaFormObjectSchema` vs `aberturaFormDraftSchema` (`.partial()` + `.strict()`)

2. **`aceite.ts`** — `registroAceiteSchema`, `aceiteTermoRequestSchema`
   - Payload válido
   - Versão de termo ausente/inválida

3. **`documentos.ts`** — `documentoUploadSchema`, `documentosSocioSchema`, `documentosImovelSchema`, `documentosFormSchema`
   - Campo de upload válido/inválido

4. **`alteracao.ts`** — Schemas completos (identificação, tipo alteração, Q01-Q09, master)
   - Payloads válidos e inválidos para cada quadro
   - Regras de `.superRefine()` (quadro selecionado obriga preenchimento)

5. **`constants/termo.ts`** — `TERMO_VERSAO_ATUAL`
   - Verificar valor da constante

### Pré-requisitos

- Node modules instalados (`npm install` na raiz)
- Zod já em `packages/shared/package.json` como dependência

### Verificação

- `npm run test` roda a suíte completa
- `npm run test:coverage` passa com 95% perFile
- `packages/shared/src/schemas/` e `packages/shared/src/constants/` com 100% de cobertura
- `npm run lint` passando