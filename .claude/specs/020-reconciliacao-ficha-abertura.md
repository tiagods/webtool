---
id: "020"
title: "Reconciliação da Ficha de Abertura (ficha ↔ doc ↔ implementação)"
status: done   # draft | review | approved | in-progress | done | rejected
created: 2026-07-13
updated: 2026-09-18
author: "Claude"
batch_size: "medium"
depends_on: ["003"]
---

> **DECISÃO REGISTRADA 2026-09-18 (usuário): Opção B — enxugar.** Os campos "extras" do sócio
> que não existem na ficha de Abertura são removidos da implementação (schema, UI, Revisão e
> validador Go) para casar com a ficha original. A spec deixa de estar bloqueada e pode ser
> aprovada/implementada (ainda **não** iniciada — este registro antecede o batch).

> **ATUALIZAÇÃO 2026-09-16 — paridade com o validador Go (specs 022–028).** O backend foi
> migrado para Go e o validador em `apps/backend/domain/validation/` espelha os schemas Zod
> de `packages/shared/src/schemas/`. Qualquer alteração nos schemas Zod (como as previstas
> nesta spec: campos novos no Passo 2, pró-labore, schema de sócio) **deve ser refletida no
> validador Go correspondente** e nos casos de caracterização em `testdata/`. A suíte de
> caracterização (`scripts/gen-abertura-characterization.mjs`) precisa ser regenerada e
> validada (`make -C apps/backend test`) após as mudanças de schema — sem isso o validador Go
> e o frontend divergem, quebrando a verificação de contrato E2E.

# Reconciliação da Ficha de Abertura (ficha ↔ doc ↔ implementação)

## Contexto

A auditoria cruzando **ficha original** (`fichas/FICHA CADASTRAL - ABERTURA DE EMPRESA.doc` e `...ABERTURA UNIPESSOAL.doc` — extraídas via `olefile`) contra o **doc de produto** (`docs/ficha-abertura.md`) e a **implementação** (`packages/shared/src/schemas/abertura.ts` + `apps/web/components/forms/*`) revelou desvios não cobertos por nenhuma spec. As specs 002/003 afirmam "schemas refletindo totalmente a documentação", logo estes desvios são *drift*, não decisões intencionais registradas.

**A ficha é a fonte da verdade.** O doc `docs/ficha-abertura.md` já foi atualizado (nesta mesma sessão) para incluir os campos do Passo 2 que faltavam. Falta reconciliar a **implementação**.

## Objetivo

Alinhar a implementação da Abertura à ficha original nos pontos inequívocos:

1. **Passo 2 (Endereço)** — adicionar os 4 campos que a ficha exige e a implementação não tem.
2. **Passo 3 (Sócios)** — corrigir o valor de pró-labore mínimo desatualizado.
3. **Passo 3 (Sócios)** — **enxugar** os campos "extras" que não existem na ficha de Abertura
   (decisão B, registrada em 2026-09-18 — ver seção 3).

## Fora de escopo

- Qualquer mudança na Ficha de Alteração / Spec 012 (formulário separado, sócio não compartilhado).
- Alteração das fichas originais em `fichas/` (são documentos históricos, imutáveis).
- Enforcement server-side de completude de documentos (Passo 5) — desvio separado, não faz parte desta reconciliação.

## Design

### Camadas afetadas

| Camada | Arquivo | Ação |
|--------|---------|------|
| Shared | `packages/shared/src/schemas/abertura.ts` | MODIFY (`stepEnderecoSchema`, `socioSchema`) |
| Forms | `apps/web/components/forms/StepEndereco.tsx` | MODIFY (4 campos novos + condicionais) |
| Forms | `apps/web/components/forms/StepSocios.tsx` | MODIFY (pró-labore; sócio — conforme decisão) |
| Forms | `apps/web/components/forms/StepRevisao.tsx` | MODIFY (refletir campos novos/removidos) |
| Motor | `apps/web/app/abertura/StepperEngine.tsx` | MODIFY (campos do `.trigger()` do Passo 2) |
| Go | `apps/backend/domain/validation/abertura.go` | MODIFY — espelhar mudanças no schema Zod |
| Go | `apps/backend/domain/validation/testdata/` | MODIFY — regenerar casos de caracterização |

### 1. Passo 2 — campos faltantes (INEQUÍVOCO)

A ficha (Ltda e SLU) pede, além do que já existe:

| Campo | Tipo | Regra |
|---|---|---|
| `correspondencia` | `enum('sim','nao')` | Obrigatório — "Este endereço será de correspondência também?" |
| `enderecoCorrespondencia` | `string` | Condicional — obrigatório se `correspondencia === 'nao'` |
| `imovelAlugado` | (já existe, migrar `boolean` → `enum('sim','nao')` p/ casar com a ficha) | — |
| `locadorTipo` | `enum('pessoa_fisica','pessoa_juridica')` | Condicional — obrigatório se `imovelAlugado === 'sim'` |
| `tipoFuncionamento` | `enum('estabelecimento','ponto_contato')` | Obrigatório — "Estabelecimento com atendimento ou ponto de contato?" |

> `correspondencia` e `tipoFuncionamento` já constam no doc; `locadorTipo` e `enderecoCorrespondencia` foram adicionados ao doc nesta sessão. Schema Zod de referência já está em `docs/ficha-abertura.md` (Passo 2). As condicionais entram via `.superRefine()` no `stepEnderecoSchema` (base sem refine exportada separadamente, para preservar `aberturaFormDraftSchema` — ver lição Spec 010).

### 2. Passo 3 — pró-labore mínimo (INEQUÍVOCO)

`abertura.ts:34` usa `min(1412)` ("Simulando 2024"). Corrigir para o salário mínimo vigente (doc referencia `1518`). **Ideal:** tornar o valor configurável via env var (ver Spec 018 — config-via-env-vars) em vez de hardcode; se a 018 não estiver pronta, aplicar `1518` com comentário datado.

### 3. Passo 3 — campos "extras" do sócio (DECISÃO: Opção B — enxugar)

A implementação coleta, **totalmente construídos na UI** (`StepSocios.tsx`), campos que **não
existem na ficha de Abertura**: `cpf`, `rg`, `nacionalidade`, `nomeMae`, `nomePai`, endereço
residencial de registro (`cepRegistro`, `logradouroRegistro`, `numeroRegistro`,
`complementoRegistro`, `bairroRegistro` — com auto-preenchimento ViaCEP próprio) e
`registroConselho`. Na ficha de Abertura, CPF/RG entram apenas como **upload de documento**
(Passo 5), não como campos. Esses campos pertencem ao **perfil da Ficha de Alteração** (sócio
robusto cedente/cessionário), não ao da Abertura.

**Decisão do usuário (2026-09-18): Opção B — enxugar.** Remover os campos acima do
`stepSociosSchema`/`socioSchema` e a seção correspondente da UI (`StepSocios.tsx`), da Revisão
(`StepRevisao.tsx`) e do validador Go (`abertura.go` + `testdata/`). O que **permanece** no
sócio da Abertura (está na ficha ou é usado pelo fluxo): `nome`, `pis`, `profissao`,
`proLabore`, `telefoneCelular`, `telefoneFixo`, `email`, `estadoCivil`, `teveParticipacaoSocietaria`,
`cnpjParticipacao`.

> Varredura obrigatória de usos antes de remover: `StepDocumentos.tsx` (condicionais por
> `estadoCivil`/`profissao` — dependem de campos que **ficam**), `StepRevisao.tsx`, o payload de
> submit e a (futura) geração de PDF. `docs/ficha-abertura.md` volta a espelhar a ficha.

## Critérios de aceite

- [ ] **CA1** — `stepEnderecoSchema` inclui `correspondencia`, `enderecoCorrespondencia` (cond.), `locadorTipo` (cond.) e `tipoFuncionamento`, com `imovelAlugado` como `enum('sim','nao')`; condicionais via `.superRefine()` sem quebrar `aberturaFormDraftSchema`.
- [ ] **CA2** — `StepEndereco.tsx` renderiza os 4 campos, exibindo `locadorTipo` só quando alugado e `enderecoCorrespondencia` só quando `correspondencia === 'nao'`; `StepperEngine` inclui os novos campos no `.trigger()` do passo.
- [ ] **CA3** — Pró-labore mínimo corrigido (env var se Spec 018 pronta; senão `1518` com comentário datado).
- [ ] **CA4** — Decisão B aplicada: campos extras do sócio removidos do `socioSchema`, da UI
  (`StepSocios.tsx`), da Revisão (`StepRevisao.tsx`) e do validador Go; usos remanescentes
  varridos (`StepDocumentos`, payload de submit); `docs/ficha-abertura.md` consistente com o
  schema final.
- [ ] **CA5** — `docs/ficha-abertura.md` consistente com o schema final (Passo 2 e Passo 3).
- [ ] **CA6** — `apps/backend/domain/validation/abertura.go` espelha as mudanças de schema (alinhado com `packages/shared/src/schemas/abertura.ts`)
- [ ] **CA7** — `scripts/gen-abertura-characterization.mjs` regenerado e `make -C apps/backend test` verde (caracterização validando a paridade Go ↔ Zod)
- [ ] **CA8** — `npm run build` e `npm run lint` passam; fluxo E2E de Abertura (Ltda e SLU) validado manualmente ponta a ponta, incluindo as condicionais do Passo 2.

## Notas

- Ficha de Alteração vs ficha de Abertura: os formulários de sócio **não compartilham schema** (perfis distintos) — reforçado em `docs/ficha-abertura.md` (nota de escopo no Passo 3) e assumido na Spec 012.
- Desvios menores observados e **conscientemente deixados de fora** desta spec (avaliar depois): SLU não trava exatamente 1 sócio no schema (só a UI oculta "+adicionar"); documentos condicionais (certidão de casamento/contrato de locação/registro conselho) são `optional` no Zod sem enforcement de condicionalidade.
- Extração das fichas: `fitz` (PyMuPDF) para PDF, `olefile` + decode cp1252 para `.doc` binário.
- **Paridade Go (pós-cutover):** toda mudança em `packages/shared/src/schemas/abertura.ts` exige espelho em `apps/backend/domain/validation/abertura.go`. Os casos de caracterização em `testdata/` são gerados a partir dos schemas Zod via `scripts/gen-abertura-characterization.mjs` — este script deve ser reexecutado sempre que o schema mudar, e a validação Go deve passar (`make -C apps/backend test`). Sem esse passo, a divergência entre validador front e back quebra a verificação de contrato E2E.
