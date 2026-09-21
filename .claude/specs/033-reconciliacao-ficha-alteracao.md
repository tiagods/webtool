---
id: "033"
title: "Reconciliação da Ficha de Alteração (ficha ↔ doc ↔ implementação)"
status: done   # draft | review | approved | in-progress | done | rejected
created: 2026-09-20
author: "Claude"
batch_size: "medium"
depends_on: ["012", "020"]
---

> **PRÉ-REQUISITO:** Spec 020 (reconciliação da Ficha de Abertura) concluída. Esta spec assume que o schema de Abertura já foi enxugado (Decisão B) e que os 4 novos campos do Passo 2 foram adicionados.

# Reconciliação da Ficha de Alteração (ficha ↔ doc ↔ implementação)
## Contexto

A Spec 012 implementou o fluxo completo da Ficha de Alteração Contratual a partir de
`docs/ficha-alteracao.md`. A Spec 020 reconciliou a Ficha de Abertura com sua ficha original.
Agora é a vez de auditar a Ficha de Alteração cruzando:

1. **Ficha original** (`fichas/FICHA CADASTRAL - ALTERAÇÃO CONTRATUAL.doc/.pdf` — 5 páginas)
2. **Doc de produto** (`docs/ficha-alteracao.md`)
3. **Implementação** (`packages/shared/src/schemas/alteracao.ts` + forms + Go validator)

A auditoria também valida **recursos compartilhados** entre Abertura e Alteração.

## Objetivo

1. **Q03 — Endereço:** Confirmar fidelidade à ficha original (sem herdar os 4 campos do Passo 2 da Abertura).
2. **Q04 — Quadro Societário:** Auditar campo por campo do membroBase e da união discriminada cedente/cessionário.
3. **Q05 — Capital Social:** Validar modelagem de aumento/redução contra a ficha.
4. **Recursos compartilhados:** Centralizar enums comuns (estadoCivil, tipoConstituicao) em `packages/shared/src/constants/enums.ts`.

## Fora de escopo

- Mudanças na Ficha de Abertura (Spec 020).
- Arquivos originais em `fichas/` (imutáveis).
- Upload de documentos, PDF, e-mail (Spec 013).

## Design

### Camadas afetadas

| Camada | Arquivo | Ação |
|--------|---------|------|
| Shared | `packages/shared/src/constants/enums.ts` | NEW |
| Shared | `packages/shared/src/schemas/alteracao.ts` | MODIFY |
| Shared | `packages/shared/src/schemas/abertura.ts` | MODIFY |
| Docs | `docs/ficha-alteracao.md` | MODIFY |
| Go | `apps/backend/domain/validation/alteracao.go` | MODIFY se necessário |

### 1. Q03 — Endereço ✅ ALINHADO

A implementação atual (logradouro, bairro, municipio, estado, cep, iptu) bate exatamente
com a ficha original. Os 4 campos novos da Abertura (correspondencia, enderecoCorrespondencia,
locadorTipo, tipoFuncionamento) NÃO se aplicam — são exclusivos do Passo 2 da Abertura.

**Ação:** Nenhuma mudança no schema. Atualizar docs.

### 2. Q04 — Quadro Societário ✅ ALINHADO

Todos os 30 campos do membroBase batem com a ficha original. Cedente sem proLabore/socioAdministrador,
cessionário com ambos. União discriminada correta.

**Ação:** Nenhuma.

### 3. Q05 — Capital Social ✅ ADEQUADO

tipoAlteracao 'aumento'|'reducao' com condicionais está correto. Redução só exige valorCapitalSocial.

**Ação:** Nenhuma. Atualizar docs.

### 4. Centralização de enums compartilhados

Criar `packages/shared/src/constants/enums.ts`:

```ts
export const TIPO_CONSTITUICAO = ['ltda', 'slu'] as const;

export const ESTADO_CIVIL_BASE = [
  'solteiro', 'casado_comunhao_parcial', 'casado_comunhao_universal',
  'casado_separacao_bens', 'casado_separacao_obrigatoria',
  'viuvo', 'separado_judicialmente',
] as const;

export const ESTADO_CIVIL_ALTERACAO = [
  ...ESTADO_CIVIL_BASE, 'divorciado',
] as const;
```

Schemas passam a importar dessas constantes. Nenhum valor muda.
## Critérios de aceite

- [x] **CA1** — Q03 Endereço permanece inalterado. `docs/ficha-alteracao.md` documenta `logradouro` como campo único.
- [x] **CA2** — Q04 Quadro Societário permanece inalterado. Schema, UI e Go batem campo a campo com a ficha.
- [x] **CA3** — Q05 Capital Social permanece com `tipoAlteracao: 'aumento' | 'reducao'`. Docs documentam redução.
- [x] **CA4** — `packages/shared/src/constants/enums.ts` criado com `TIPO_CONSTITUICAO`, `ESTADO_CIVIL_BASE` e `ESTADO_CIVIL_ALTERACAO`. Schemas importam destas constantes.
- [x] **CA5** — `apps/backend/domain/validation/alteracao.go` e `abertura.go` espelham quaisquer mudanças. Testes passam.
- [x] **CA6** — `docs/ficha-alteracao.md` atualizado consistentemente (Q03, Q05, enums compartilhados).
- [x] **CA7** — `npm run build` e `npm run lint` passam. `make -C apps/backend test` verde.
- [x] **CA8** — Fluxo E2E de Alteração validado; Abertura não regride.

## Notas

- Q01, Q02, Q06, Q07, Q08, Q09 — sem discrepâncias na auditoria.
- O sócio da Alteração (~30 campos) NÃO compartilha schema com o da Abertura (10 campos). Decisão 4 da Spec 012 confirmada.
- **Paridade Go:** toda mudança de schema exige espelho no validador Go + regeneração de testdata.
- **Workaround de workspace:** Em git worktree, criar junction `node_modules/@prolink/shared` → `packages/shared` se o build resolver para o ROOT em vez do worktree.