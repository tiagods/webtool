---
id: "012"
title: "Ficha de Alteração Contratual (novo formulário)"
status: done
created: 2026-07-07
author: "Claude"
batch_size: "medium"
depends_on: ["001", "003", "008"]
---

# Ficha de Alteração Contratual (novo formulário)

## Contexto

`docs/arquitetura.md` lista a Ficha de Alteração Contratual como "⏳ Pendente — próxima fase". O design de produto completo já existe em `docs/ficha-alteracao.md` e é a **fonte de verdade** desta spec: 4 passos (Identificação → Tipo de Alteração → Novos Dados dinâmicos por quadro → Revisão e Envio), cobrindo 9 quadros possíveis (Q01–Q09: razão social, objeto social, endereço, quadro societário, capital social, redistribuição de capital, natureza jurídica, administração, outras alterações). Nenhuma linha de código existe ainda — sem rota `/alteracao`, sem schema em `packages/shared`, sem API routes específicas.

Este formulário reaproveita a infra de sessão/rascunho/submit de `apps/api` (Spec 008), mas com rotas, schemas e tabela próprios.

## Objetivo

Entregar o fluxo completo da Ficha de Alteração Contratual **conforme `docs/ficha-alteracao.md`**, do preenchimento ao `submit` (backup em S3 + publicação na fila SQS). Decisões fechadas na sessão de discussão:

| # | Decisão | Resolução |
|---|---------|-----------|
| 1 | Busca por CNPJ (Passo 1) | **Sem API.** O usuário preenche manualmente os dados cadastrais atuais da empresa (CNPJ, razão social, nome fantasia, tipo de constituição, endereço atual, situação). Decisão para agora — pode voltar a ser automática no futuro. |
| 2 | Modelagem do Passo 3 dinâmico | **Schema Zod único** com todos os quadros opcionais + `superRefine` que valida apenas os quadros presentes em `quadros[]`. Mesmo padrão de `aberturaFormObjectSchema`; campos/validações **exatamente** como no doc. |
| 3 | Rotas de API | **Rotas próprias `/api/alteracao/*`** reusando `lib/auth`, `lib/rateLimit`, `lib/aws/s3`. DynamoDB e SQS generalizados (ver Design). |
| 4 | Schema de sócio (Q04) | **Próprio da alteração** (`membroBase`/`cessionario` como no doc) — não compartilha com a Abertura. Extrai apenas enums triviais idênticos (`estadoCivil`, UFs) se já existirem. |
| 5 | Pipeline PDF/e-mail | **Fora de escopo** (Spec 013). O `submit` faz backup do payload em S3 e publica na SQS com discriminador `formType: 'alteracao'`. |

## Fora de escopo

- **Geração de PDF e envio de e-mail** (Spec 013 — Worker). O `submit` entrega até backup S3 + publish SQS.
- **Busca automática de CNPJ na Receita** (decisão 1 — preenchimento manual por ora).
- **Upload de documentos** — nenhum quadro do doc exige upload de arquivo, portanto sem rota `/upload-url` nem `documentosKeys` para este formulário.

## Design

### Fluxo (4 passos, conforme doc)

```
[1] Identificação → [2] Tipo de Alteração → [3] Novos Dados → [4] Revisão e Envio
```

### 1. Shared — `packages/shared/src/schemas/alteracao.ts`

Segue os schemas Zod do doc à risca. Exporta (via barrel em `src/index.ts`):

- `stepIdentificacaoSchema` — CNPJ (regex máscara) + razão social, nome fantasia (opcional), tipo de constituição, endereço atual, situação (`ativa`/`inapta`/`baixada`). `superRefine` (ou `.refine`) exige `situacao === 'ativa'` para prosseguir (regra do doc: "apenas ATIVA pode prosseguir").
- `quadroAlteracao` — `z.enum` com os 9 códigos do doc (`nome_empresarial`, `objeto_social`, `endereco`, `quadro_societario`, `capital_social`, `redistribuicao_capital`, `natureza_juridica`, `administracao`, `outras_alteracoes`).
- Um schema por quadro Q01–Q09 (campos/validações **exatos** do doc): `q01NomeEmpresarialSchema`, `q02ObjetoSocialSchema`, `q03EnderecoSchema`, `q04QuadroSocietarioSchema` (array de `membroBase`/`cessionario`), `q05CapitalSocialSchema`, `q06RedistribuicaoSchema`, `q07NaturezaJuridicaSchema`, `q08AdministracaoSchema`, `q09OutrasSchema`.
- `alteracaoFormObjectSchema` = `z.object` com `identificacao`, `quadros`, cada quadro `q0X` **opcional**, e `aceite: z.boolean().refine(v => v === true)`.
- `alteracaoFormSchema` = `alteracaoFormObjectSchema.superRefine(...)` — para cada código em `data.quadros`, exige que o objeto do quadro correspondente esteja presente (as validações internas de cada quadro já vêm do schema do quadro).
- `alteracaoFormDraftSchema` = `alteracaoFormObjectSchema.strict().partial().extend({ aceite: z.boolean().optional() })` — aplica a lição da Spec 010 (`.partial()` não relaxa `.refine()` de campo presente; reescrever `aceite` como opcional). O rascunho carrega **apenas quadros já completos** (o frontend valida cada quadro antes de salvar), então validar o quadro integralmente quando presente é aceitável.
- `export type AlteracaoFormValues = z.infer<typeof alteracaoFormSchema>`.

### 2. API — `apps/api/app/api/alteracao/*`

- `session/route.ts` (POST) — reusa `requireAceite` + `createOrGetSession`, e garante o item inicial na tabela de alteração (`ensureRascunhoInicial` parametrizado por tabela — ver §4). Idempotente mesmo se o cookie já existir (ex.: usuário veio da Abertura).
- `draft/route.ts` (GET/POST) — mesmo guard (`aceite` + `session`) das rotas de abertura. POST valida com `alteracaoFormDraftSchema` e persiste na tabela de alteração. Sem a variante de `uploadedCampo` (não há upload).
- `submit/route.ts` (POST) — valida com `alteracaoFormSchema`; gera protocolo `ALT-{ano}-{seq}`; faz backup do payload validado em `protocolos/{protocolo}/alteracao.json` no S3; publica na SQS com `formType: 'alteracao'`; marca a sessão como `enviado` (zera payload) e invalida o cookie. Mesma ordem de operações do submit de abertura.

### 3. SQS — `apps/api/lib/aws/sqs.ts`

Generalizar `SubmissaoMessage` com discriminador:

```ts
export type FormType = 'abertura' | 'alteracao';
export interface SubmissaoMessage {
  sessionId: string;
  protocolo: string;
  formType: FormType;
  tipo?: TipoConstituicao; // apenas abertura
}
```

O submit de abertura passa a enviar `formType: 'abertura'` (ajuste mínimo, retrocompatível para o worker da Spec 013).

### 4. DynamoDB — `apps/api/lib/aws/dynamodb.ts`

Generalizar de forma **retrocompatível** (defaults preservam o comportamento da Abertura, que está `done`):

- `RascunhoItem<TPayload>` genérico no payload; `tipo` opcional.
- Funções (`ensureRascunhoInicial`, `getRascunho`, `putRascunho`, `marcarEnviado`, `deleteDraft`, `proximoProtocolo`) recebem um parâmetro opcional de tabela (default = tabela de abertura) e, onde aplicável, prefixo de protocolo (default `PRO-`). Call sites de abertura **inalterados**.
- Nova tabela `fichas-alteracao` via env `AWS_DYNAMODB_ALTERACAO_TABLE`; contador próprio de protocolo (prefixo `ALT-`).
- `requireSession` (em `lib/auth.ts`) parametrizado por tabela (default abertura), para o guard das rotas de alteração consultar a tabela correta.

> Alternativa considerada: módulo `dynamodb-alteracao.ts` separado (zero toque na Abertura, porém duplica ~6 funções). Escolhido generalizar com defaults por ser DRY e de baixo risco (nenhum call site de abertura muda).

### 5. Frontend — `apps/web/app/alteracao/*`

Espelha a estrutura de `apps/web/app/abertura/`:

- `layout.tsx`, `page.tsx`, `confirmacao/page.tsx`, `StepperEngine.tsx` (orquestra os 4 passos, salva rascunho por passo via `/api/alteracao/draft`, chama `/api/alteracao/submit`).
- Componentes de passo em `apps/web/components/forms-alteracao/`:
  - `StepIdentificacao.tsx` (Passo 1 — dados cadastrais manuais).
  - `StepTipoAlteracao.tsx` (Passo 2 — seleção múltipla agrupada conforme o doc).
  - `StepNovosDados.tsx` (Passo 3 — renderiza dinamicamente só os sub-formulários dos quadros selecionados; Q01–Q09).
  - `StepRevisao.tsx` (Passo 4 — comparativo antes/depois por quadro + aceite + envio).
- Reuso dos tokens/design system e componentes de UI já existentes onde couber (sem re-criar inputs/botões).

## Critérios de aceite

- [x] **CA1 — Schemas compartilhados**: `packages/shared/src/schemas/alteracao.ts` implementa todos os schemas Zod (identificação, tipo, Q01–Q09, master + draft) exatamente conforme `docs/ficha-alteracao.md`, exportados via barrel. `npm run build -w packages/shared` (ou build geral) passa.
- [x] **CA2 — Rota de sessão**: `POST /api/alteracao/session` cria/reusa a sessão e garante o item inicial na tabela de alteração; exige aceite LGPD (403 sem ele).
- [x] **CA3 — Rascunho**: `GET/POST /api/alteracao/draft` salva e recupera rascunhos parciais (por passo) na tabela de alteração, com o mesmo guard de sessão; renova TTL de 2h.
- [x] **CA4 — Envio**: `POST /api/alteracao/submit` valida o payload completo, gera protocolo `ALT-{ano}-{seq}`, faz backup do payload em S3, publica na SQS com `formType: 'alteracao'`, marca `enviado` e invalida o cookie.
- [x] **CA5 — Retrocompat Abertura**: submit de abertura passa a enviar `formType: 'abertura'`; nenhum comportamento da Abertura (specs 001–009) regride — build e fluxo E2E de abertura continuam funcionando.
- [x] **CA6 — Passo 1 (UI)**: `/alteracao` renderiza o passo de identificação com preenchimento manual dos dados cadastrais; bloqueia avanço se `situacao !== 'ativa'`.
- [x] **CA7 — Passo 2 (UI)**: seleção múltipla dos quadros agrupada conforme o doc; exige ao menos 1 quadro.
- [x] **CA8 — Passo 3 (UI)**: renderiza dinamicamente apenas os sub-formulários dos quadros selecionados (Q01–Q09), com os campos/validações do doc; salva rascunho por quadro completo.
- [x] **CA9 — Passo 4 (UI)**: comparativo antes/depois por quadro, edição por seção, aceite obrigatório e CTA de envio; redireciona para confirmação com o protocolo.
- [x] **CA10 — Verificação E2E**: fluxo completo `/alteracao` preenchido de ponta a ponta resulta em `submit` bem-sucedido (protocolo retornado, item marcado `enviado`), validado manualmente conforme regra de Verificação do `.claude/CLAUDE.md`.

## Notas

- Referência de produto completa (campos, validações, schemas Zod de exemplo por quadro): `docs/ficha-alteracao.md` — **fonte de verdade**.
- Protótipo Paper: https://app.paper.design/file/01KP10MY4NWSR343R7HKDZ3KWA/3-0 (ver `[[reference_paper_pages]]` na memória do agente para o mapeamento das páginas do arquivo Paper).
- **Tamanho**: embora marcada `medium`, a feature é grande (4 passos, 9 quadros, schemas + API + frontend). O `todo.md` deve ser organizado em fases (Shared → API → Frontend → Verificação) para entrega incremental; se necessário, o batch pode ser pausado entre fases.
- Lições aplicáveis: Spec 010 (`.partial()` + `.refine()` em draft schema) e a regra de propagar falha de salvamento de rascunho para bloquear navegação.
- **Verificação (Fase 4)**: `POST /api/alteracao/session` criava um item órfão na tabela `fichas-abertura` porque `createOrGetSession` chamava `ensureRascunhoInicial` sem `tableName`. Corrigido — `createOrGetSession(cookieStore, tableName?)` propaga a tabela; call sites de Abertura inalterados (default). Ver `lessons.md` (2026-09-02).
