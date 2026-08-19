# Batch — Spec 012: Ficha de Alteração Contratual

> Fonte de verdade dos campos/validações: `docs/ficha-alteracao.md`.
> Organizado em 4 fases (Shared → API → Frontend → Verificação). O batch pode pausar entre fases.
> Regra: marcar `[/]` ao iniciar cada item e `[x]` imediatamente ao concluir. Uma task por vez.

---

## Fase 1 — Shared (`packages/shared`)  → CA1

- [x] 1.1 Criar `packages/shared/src/schemas/alteracao.ts` — `stepIdentificacaoSchema` (CNPJ máscara, razão social, nome fantasia opcional, tipo de constituição, endereço atual, `situacao` enum `ativa/inapta/baixada` + refine "só `ativa` prossegue")
- [x] 1.2 `quadroAlteracao` — `z.enum` com os 9 códigos (`nome_empresarial`, `objeto_social`, `endereco`, `quadro_societario`, `capital_social`, `redistribuicao_capital`, `natureza_juridica`, `administracao`, `outras_alteracoes`)
- [x] 1.3 Schemas por quadro Q01–Q09 (campos/validações **exatos** do doc), incluindo `q04QuadroSocietarioSchema` com sócio próprio (`membroBase`/`cessionario`, estado civil 8 opções COM divorciado)
- [x] 1.4 `alteracaoFormObjectSchema` (`z.object` base, quadros `q0X` opcionais, `aceite` refine `=== true`) — exportar base **antes** do refine (lição Spec 008/010)
- [x] 1.5 `alteracaoFormSchema = alteracaoFormObjectSchema.superRefine(...)` — cada código em `quadros[]` exige o objeto `q0X` presente
- [x] 1.6 `alteracaoFormDraftSchema = alteracaoFormObjectSchema.strict().partial().extend({ aceite: z.boolean().optional() })` (lição Spec 010)
- [x] 1.7 `export type AlteracaoFormValues` + exportar tudo no barrel `src/index.ts`
- [x] 1.8 `npm run build -w packages/shared` passa — sem `build` script no pacote (é workspace-linked, "no build step needed in dev" per CLAUDE.md); verificado via `tsc --noEmit --strict` standalone (limpo) + smoke test em runtime (8/8 assertions corretas: Q04 cnpjAnterior condicional, Q05 aumento condicional, master↔quadros cross-check, situação ativa, draft `.strict().partial()`)

## Fase 2 — API (`apps/api`)  → CA2, CA3, CA4, CA5

- [x] 2.1 Generalizar `lib/aws/sqs.ts` — `FormType = 'abertura'|'alteracao'`; `SubmissaoMessage` ganha `formType`; submit de abertura passa `formType: 'abertura'` (retrocompat)
- [x] 2.2 Generalizar `lib/aws/dynamodb.ts` — `RascunhoItem<TPayload>`; funções recebem `tableName` (default abertura) + prefixo de protocolo (default `PRO-`); nova env `AWS_DYNAMODB_ALTERACAO_TABLE` (via `getAlteracaoTableName()`); contador `ALT-`. Call sites de abertura **inalterados** (params novos são trailing+opcionais). Também: `putJsonObject()` novo em `lib/aws/s3.ts` (backup do payload da Alteração, que não tem uploads); `infra/local/init.sh` provisiona a tabela `fichas-alteracao` local
- [x] 2.3 Parametrizar `requireSession` (`lib/auth.ts`) por tabela (default abertura)
- [x] 2.4 `app/api/alteracao/session/route.ts` (POST) — `requireAceite` + `createOrGetSession` + garante item inicial na tabela de alteração (idempotente)
- [x] 2.5 `app/api/alteracao/draft/route.ts` (GET/POST) — guard aceite+session; POST valida `alteracaoFormDraftSchema`; persiste na tabela de alteração; renova TTL 2h
- [x] 2.6 `app/api/alteracao/submit/route.ts` (POST) — valida `alteracaoFormSchema`; protocolo `ALT-{ano}-{seq}`; backup `protocolos/{protocolo}/alteracao.json` no S3; publish SQS `formType: 'alteracao'`; marca `enviado`; invalida cookie
- [x] 2.7 Sem `.env.example` no repo — documentado em `deploy.md` (lista de env vars) + `docker-compose.yml`/`docker-compose.prod.yml` (`AWS_DYNAMODB_ALTERACAO_TABLE`)
- [x] 2.8 `npm run build -w apps/api` e `npm run lint -w apps/api` passam (3 rotas novas registradas: `/api/alteracao/{session,draft,submit}`)

## Fase 3 — Frontend (`apps/web`)  → CA6, CA7, CA8, CA9

- [x] 3.1 `app/alteracao/layout.tsx` + `page.tsx` + `confirmacao/page.tsx` (espelhando `app/abertura/`)
- [x] 3.2 `app/alteracao/StepperEngine.tsx` — orquestra 4 passos; salva rascunho por passo via `/api/alteracao/draft` (propaga falha → bloqueia navegação, lição Spec 010); submit via `/api/alteracao/submit`. Nova `components/StepperAlteracao.tsx` (4 passos fixos, sem branching ltda/slu)
- [x] 3.3 `components/forms-alteracao/StepIdentificacao.tsx` (Passo 1 — dados cadastrais manuais; bloqueia avanço se `situacao !== 'ativa'` via refine do schema)
- [x] 3.4 `components/forms-alteracao/StepTipoAlteracao.tsx` (Passo 2 — seleção múltipla agrupada; exige ≥1 quadro; instancia/limpa o `q0X` correspondente ao selecionar/deselecionar)
- [x] 3.5 `components/forms-alteracao/StepNovosDados.tsx` + `components/forms-alteracao/quadros/Q01..Q09*.tsx` (Passo 3 — renderiza dinamicamente só os quadros selecionados; Q04 com tabs cedente/cessionário via discriminated union)
- [x] 3.6 `components/forms-alteracao/StepRevisao.tsx` (Passo 4 — resumo por quadro + link "Editar" por seção + aceite + envio → confirmação com protocolo). Nota: comparativo "antes/depois" completo não é possível para todos os quadros (decisão Spec 012 de não usar API de CNPJ = sem dado "antes" de fábrica); implementado para identificação/endereço, e como "novos dados solicitados" para os demais
- [x] 3.7 Reuso dos tokens/design system e componentes de UI existentes (Input/Textarea/Checkbox/Button/Select, RadioCard/RadioChip, masks, useViaCEP) — sem recriar inputs/botões. Novo `lib/uf.ts` (lista de UFs) e `quadros.config.ts` (metadados dos 9 quadros compartilhados entre os passos 2/3/4)
- [x] 3.8 `npm run build -w apps/web` e `npm run lint -w apps/web` passam. Smoke test manual: dev server temporário (porta 3010, já que 3000/3001 estão ocupados pelos containers Docker locais) + `curl` nos 4 passos — pegou e corrigiu 1 bug real (`FormLabel` usado fora de `FormField`/`FormItem` em `StepIdentificacao.tsx`, lançava runtime error); forçado defaultValues com os 9 quadros preenchidos (incl. Q04 com 1 cedente + 1 cessionário) para validar que todos renderizam sem erro — confirmado, revertido antes de finalizar

## Fase 4 — Verificação  → CA10

- [ ] 4.1 `npm run build` (geral) e `npm run lint` passam
- [ ] 4.2 Retrocompat: fluxo E2E de Abertura (Ltda e SLU) continua funcionando (CA5)
- [ ] 4.3 E2E `/alteracao` ponta a ponta: preencher Passo 1→4 com ≥1 quadro → submit OK (protocolo `ALT-` retornado, item `enviado`, cookie invalidado)
- [ ] 4.4 Marcar CA1–CA10 na spec 012; rodar `/done`

---

### Lições relevantes (revisadas no início do batch)
- **Spec 008/010** — exportar `z.object` base **antes** de `.superRefine()`; `.partial()` é raso (não relaxa `.refine()` de campo presente) → reescrever `aceite` como `.optional()` no draft schema.
- **Spec 010** — função de "salvar rascunho" deve **retornar sucesso/falha**; chamador bloqueia navegação e avisa se falhar (nunca só `console.error`).
- **Spec 009** — workspaces Next.js só-de-Route-Handlers ainda precisam de `lib: ["dom", ...]`.
- **Spec 008 (build)** — nunca rodar `npm run build` de verificação com o dev server da mesma app de pé (corrompe `.next`).
