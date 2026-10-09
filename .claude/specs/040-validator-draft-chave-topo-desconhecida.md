---
id: "040"
title: "Validador draft: paridade total com o Zod strict().partial() (chave de topo desconhecida + regras field-level em draft)"
status: done           # draft | review | approved | in-progress | done | rejected
created: 2026-10-08
author: "Tiago"
batch_size: "medium"   # small (≤ meio dia) | medium (≤1 dia)
depends_on: []         # HARD - sem estas specs a mudanca nao compila/nao faz sentido
prefer_after: []       # ordem preferida - apenas avisa, nunca bloqueia
touches:               # globs dos paths que a spec altera - detecta colisao entre worktrees
  - "apps/backend/domain/validation/abertura.go"
  - "apps/backend/domain/validation/alteracao.go"
  - "apps/backend/domain/validation/alteracao_test.go"
  - "apps/backend/domain/validation/testdata/veredito_esperado.json"
  - "apps/backend/domain/validation/testdata/veredito_alteracao_esperado.json"
---

# Validador draft: paridade total com o Zod `strict().partial()`

## Contexto

Durante os gates finais do spec 039 (`/done`), 3 testes falham de forma idêntica em
`main` (`02d07c4`) e na branch do spec 039 — falhas de **baseline**, fora do escopo do
039, que mantêm `make test` / `make test-integration` vermelhos:

| Teste | Pacote | Falha observada |
|-------|--------|-----------------|
| `TestRascunhoService_Salvar/chave_de_topo_desconhecida_→_issues,_sem_gravar` | `domain/service` (`rascunho_test.go:69`) | `Salvar` retorna 0 issues para `{"foo":"bar"}`; esperava issues e sem gravar |
| `TestAlteracaoRascunhoService_Salvar/chave_de_topo_desconhecida_→_issues,_sem_gravar` | `domain/service` (`rascunho_alteracao_test.go:68`) | idem, via `ValidarAlteracaoDraft` |
| `TestPostDraft/chave_de_topo_desconhecida_→_400_com_corpo_do_Node` | `adapter/web` (`draft_upload_test.go:109`) | `POST /drafts` responde 200; esperava 400 com corpo do Node |

### Raiz do problema (diagnosticada em 2026-10-08)

Em `domain/validation/abertura.go`, o acumulador tem este contrato (comentário nas
linhas 135–137):

```go
// No modo draft (draft=true), v.add() é no-op; só addFatal() persiste.
func (v *validador) add(path []any, msg string) {
	if v.draft {
		return
	}
	...
}
```

Os dois entrypoints de draft **chamam `v.add()`** para a rejeição de chave de topo
desconhecida — que é exatamente o no-op em modo draft:

- `abertura.go:236` (`ValidarAberturaDraft`):
  `v.add(nil, "Unrecognized key(s) in object: "+listar(desconhecidas))`
- `alteracao.go:217` (`ValidarAlteracaoDraft`):
  `v.add(nil, "Unrecognized key(s) in object: "+listar(fora))`

Resultado: a issue "Unrecognized key(s)..." é **silenciada no único modo em que ela
deveria aparecer**. O contrato declarado nos docstrings é o oposto do comportamento:

- `ValidarAberturaDraft` (abertura.go:223–225): "chave de topo desconhecida é
  rejeitada"
- `ValidarAlteracaoDraft` (abertura.go:203–204): "chave de topo desconhecida e
  `aceite` não-booleano são rejeitados"

Nota: o modo **full** (`ValidarAberturaForm`) ignora chaves desconhecidas
**intencionalmente** (abertura.go:204–206: "o schema completo não é estrito") — esse
comportamento está correto e não muda nesta spec.

### Descobertas na execução (2026-10-08 — ampliação aprovada pelo usuário)

Aplicada a correção de 2 linhas, a suíte completa revelou mais falhas, e a
investigação (tudo comprovado com `git`/execução, nada assumido) mostrou:

1. **Premissa original incorreta.** A suíte de caracterização **tem** casos draft
   com chave desconhecida — `draft_chave_topo_desconhecida` (input `{"foo":"bar"}`,
   o mesmo dos 3 testes unitários) existe nas duas suítes, com veredito gravado
   `aceito: true`, ou seja, **codificando o bug**. A verificação original procurou a
   string "Unrecognized" no testdata; o veredito gravado é "aceito", então a string
   nunca aparece.
2. **Testdata defasada.** Reexecutar os scripts geradores canônicos
   (`scripts/gen-{abertura,alteracao}-characterization.mjs`, que rodam os schemas
   Zod reais de `packages/shared`) regenera **6** vereditos, não 2: o testdata foi
   gerado em 2026-09-07 (spec 025) e os schemas foram reconciliados com as fichas em
   2026-09-20 (`8efd6d4`, `afb4801`) sem regeneração. Os `casos_*.json` (inputs)
   não mudam — só os vereditos.
3. **As 4 divergências extras têm a MESMA família de causa raiz** — o no-op de
   `v.add` em modo draft silencia em Go o que o Zod valida (tudo já estava
   portado):

   | Caso (veredito que muda) | Suite | Regra silenciada em draft (call site Go) |
   |---|---|---|
   | `draft_chave_topo_desconhecida` | abertura | rejeição de chave desconhecida (`abertura.go:236`, `v.add`) |
   | `draft_chave_topo_desconhecida` | alteracao | idem (`alteracao.go:217`, `v.add`) |
   | `draft_sociedade_incompleta` | abertura | `sociedade/capitalSocial < 0.01` (`abertura.go:477`, `v.add`) |
   | `draft_identificacao_inapta` | alteracao | refine "apenas ATIVA pode prosseguir" (`alteracao.go:264`, `v.add`) |
   | `draft_q05_aumento_incompleto` | alteracao | refine de integralização quando `aumento` (`alteracao.go:589,592`, `v.add`) |
   | `draft_q07_outras_sem_especificar` | alteracao | refine `especificar` quando `outras` (`alteracao.go:638`, `v.add`) |

   Ground truth (Zod): os schemas draft são `strict().partial()` (com
   `documentosAceitos`/`aceite` reescritos como booleano opcional sem refine) —
   `.partial()` só torna a CHAVE opcional; campos **presentes** são validados por
   inteiro, refines incluídos (lição 2026-07-07).
4. **Script gerador quebrado em qualquer árvore** (achado novo):
   `packages/shared/src/schemas/*.ts` importam `../constants/enums` sem extensão e o
   Node ESM (type-stripping) não faz extensão-guessing. Workaround usado neste
   batch: hook de resolver `--import` temporário (arquivos `scripts/t040-*.mjs` não
   versionados na worktree; removidos ao final).

## Objetivo

Restabelecer a paridade total entre o validador Go em modo draft e o schema Zod
draft: (a) chave de topo desconhecida gera issue e o payload não é persistido (os 3
testes de baseline acima ficam verdes; na API, 400 com corpo no formato do Node);
(b) campos presentes são validados por inteiro em modo draft (regras field-level +
refines), como o `.strict().partial()` faz; (c) testdata regenerada pelos scripts
canônicos com os schemas atuais.

## Fora de escopo

- Estritizar o schema full (`ValidarAberturaForm`) — chaves desconhecidas
  continuam ignoradas no submit completo, por decisão de design. O modo full
  mantém exatamente o comportamento de hoje (nenhum veredito full muda na
  regeneração).
- Frontend e Node (o corpo de resposta 400 já segue o formato do Node via
  presenter).
- Consertar a resolução Node ESM dos scripts geradores (imports sem extensão em
  `packages/shared`) — registrado como achado; o batch usa um hook temporário.
  Candidato a chore/spec futuro.

## Design

Três correções, todas em `domain/validation`:

### A — Rejeitar chave de topo desconhecida em draft (escopo original)

Trocar `v.add` por `v.addFatal` nos dois entrypoints de draft. Por que `addFatal` é
a semântica correta: a chave desconhecida é erro estrutural (nível de tipo), que é
exatamente o que "fatal/aborted" significa para o acumulador; e `aborted=true` não
causa efeito colateral no caminho draft (o cross-field não roda em modo draft de
qualquer forma, e o helper `secao()` (abertura.go:323) não inspeciona
`v.aborted` — seções conhecidas presentes continuam sendo parseadas).

### B — Remover o no-op de draft de `v.add` (causa raiz da família)

- Apagar o guard `if v.draft { return }` de `add` (abertura.go:144–147);
- apagar o campo `draft` do struct `validador` (sem uso após a mudança) e os dois
  inicializadores `&validador{draft: true}` (abertura.go:232, alteracao.go:214);
- atualizar os docstrings de `validador` (linhas 135–137) e dos entrypoints de
  draft.

O `.partial()` do Zod não relaxa a validação de valores presentes (lição
2026-07-07) — o port Go deve espelhar isso nos dois modos. `add` não seta
`aborted`, então os guards de cross-field do modo full (`if !v.aborted`) não são
afetados. As 4 regras portadas e silenciadas (tabela em Contexto) passam a emitir
issues em draft — exatamente o que o Zod emite. Os 2 subtests de
`TestAlteracaoRefinesCondicionais` (`alteracao_test.go`) que assertavam o no-op
antigo ("esperava aceito em draft" para q05-aumento/q07-outras sem os campos
obrigatórios) são atualizados para o contrato de paridade.

### C — Regenerar o testdata de caracterização

Rodar `node scripts/gen-abertura-characterization.mjs` e
`node scripts/gen-alteracao-characterization.mjs` (com o hook temporário) e
versionar os vereditos regenerados. Diff restrito a 6 vereditos (todos draft);
inputs (`casos_*.json`) idênticos.

### Camadas afetadas

| Camada | Arquivo | Ação |
|--------|---------|------|
| Domain | `apps/backend/domain/validation/abertura.go` | EDIT — `add`→`addFatal` (236); no-op + campo `draft` removidos (137–147, 232); docstrings |
| Domain | `apps/backend/domain/validation/alteracao.go` | EDIT — `add`→`addFatal` (217); inicializador `draft` removido (214) |
| Testdata | `apps/backend/domain/validation/testdata/veredito_esperado.json` | REGEN — 2 vereditos |
| Testdata | `apps/backend/domain/validation/testdata/veredito_alteracao_esperado.json` | REGEN — 4 vereditos |
| Test | `apps/backend/domain/validation/alteracao_test.go` | EDIT — 2 subtests de `TestAlteracaoRefinesCondicionais` atualizados para o contrato de paridade |

### Risco

Médio (aceito pelo usuário em 2026-10-08). Muda comportamento: 5 cenários de draft
antes aceitos pelo backend passam a ser rejeitados (400) — mas o frontend
pré-valida com o MESMO schema Zod antes de enviar, então a mudança não é visível ao
usuário e só afeta consumidores diretos da API. A suíte de caracterização
(regenerada) + a suíte unitária provam a paridade.

## Critérios de aceite

- [x] `TestRascunhoService_Salvar` verde (subteste `chave_de_topo_desconhecida` incluído)
- [x] `TestAlteracaoRascunhoService_Salvar` verde (subteste `chave_de_topo_desconhecida` incluído)
- [x] `TestPostDraft` verde (subteste `chave_de_topo_desconhecida → 400 com corpo do Node`)
- [x] `TestCaracterizacaoAbertura` e `TestCaracterizacaoAlteracao` verdes contra o
  testdata regenerado (todos os casos, full + draft)
- [x] `make -C apps/backend test` e `make -C apps/backend test-integration` **100% verdes**
- [x] Gates do escopo tocado verdes (ver tabela em `.claude/commands/done.md`):
  - `apps/backend/**` → `make -C apps/backend lint` + `make -C apps/backend test` + `docker compose build api` (o serviço do compose se chama `api`)
- [x] testdata regenerada pelos scripts canônicos: exatamente 6 vereditos mudados
  (2× `draft_chave_topo_desconhecida` + `draft_sociedade_incompleta` +
  `draft_identificacao_inapta` + `draft_q05_aumento_incompleto` +
  `draft_q07_outras_sem_especificar`); `casos_*.json` inalterados

## Notas

- Diagnosticado durante o `/done` do spec 039 (2026-10-08), quando a comparação com
  `main` provou que as 3 falhas pré-existiam (`git` limpo em `02d07c4` com as mesmas
  falhas).
- Mensagem de issue gerada: `Unrecognized key(s) in object: 'foo'` (mesma forma do
  Zod/Node que o front exibe).
- Escopo ampliado de "correção de 2 linhas" para "paridade total de draft" em
  2026-10-08, aprovado pelo usuário com base nas descobertas registradas em
  Contexto (a premissa "não existe caso draft com chave desconhecida no testdata"
  estava incorreta — ver item 1 das descobertas).
- Script gerador exige hook de resolver Node ESM (imports `.ts` sem extensão em
  `packages/shared`); neste batch o hook foi `--import
  file:///.../scripts/t040-register.mjs` (arquivos temporários removidos ao final do
  batch). Registra em lessons.
- Achado de baseline: 7 arquivos do módulo estavam fora do gofmt em `main`
  (incluindo os 2 validadores — alinhamento de tags em `enderecoForm` + EOF sem
  newline), deixando `make lint` (fmt-check) vermelho no baseline. Corrigido com
  `gofmt -w` como condição do gate; arquivos: `domain/validation/{abertura,
  alteracao}.go` + 5 `infrastructure/*_test.go` de integração.
- Encerrada em 2026-10-08: todos os critérios verificados — unit `-race` 100%,
  `go vet`/`gofmt`/`golangci-lint v2` limpos, `docker compose build api` e
  `test-integration` 100% verdes contra a stack local (subida/derrubada deste
  worktree). Commits: `3433fdf` (ampliação da spec), `a922a5e` (fix),
  `1d288d2` (gofmt) + este commit de fechamento.
