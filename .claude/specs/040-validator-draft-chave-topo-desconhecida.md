---
id: "040"
title: "Validador draft: rejeitar chave de topo desconhecida (v.add é no-op em modo draft)"
status: in-progress    # draft | review | approved | in-progress | done | rejected
created: 2026-10-08
author: "Tiago"
batch_size: "small"    # small (≤ meio dia) | medium (≤1 dia)
depends_on: []         # HARD - sem estas specs a mudanca nao compila/nao faz sentido
prefer_after: []       # ordem preferida - apenas avisa, nunca bloqueia
touches:               # globs dos paths que a spec altera - detecta colisao entre worktrees
  - "apps/backend/domain/validation/abertura.go"
  - "apps/backend/domain/validation/alteracao.go"
---

# Validador draft: rejeitar chave de topo desconhecida

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
- `ValidarAlteracaoDraft` (alteracao.go:203–204): "chave de topo desconhecida e
  `aceite` não-booleano são rejeitados"

Nota: o modo **full** (`ValidarAberturaForm`) ignora chaves desconhecidas
**intencionalmente** (abertura.go:204–206: "o schema completo não é estrito") — esse
comportamento está correto e não muda nesta spec.

## Objetivo

Fazer os 3 testes acima ficarem verdes, restabelecendo o contrato declarado: em modo
draft, chave de topo desconhecida gera issue e o payload não é persistido (na API,
resposta 400 com o corpo de issues no formato do Node).

## Fora de escopo

- Estritizar o schema full (`ValidarAberturaForm`) — chaves desconhecidas continuam
  ignoradas no submit completo, por decisão de design.
- Qualquer mudança de comportamento de campo (field-level) dos validadores.
- A suíte de caracterização `domain/validation/testdata` — não existe caso draft com
  chave desconhecida nela (verificado: "Unrecognized" ocorre só nas 2 linhas do bug).
- Frontend e Node (o corpo de resposta 400 já segue o formato do Node via presenter).

## Design

Correção pontual de 2 linhas: trocar `v.add` por `v.addFatal` nos dois entrypoints de
draft.

### Por que `addFatal` é a semântica correta

- O contrato do `validador` diz que, em modo draft, **só** `addFatal` persiste — a
  chave desconhecida é erro estrutural (nível de tipo), que é exatamente o que
  "fatal/aborted" significa para o acumulador.
- `aborted=true` não causa efeito colateral no caminho draft: o cross-field não roda
  em modo draft de qualquer forma (os guards `if !v.aborted` são só dos modos full),
  e o helper `secao()` (abertura.go:323) **não** inspeciona `v.aborted` — seções
  conhecidas presentes continuam sendo parseadas normalmente.

### Camadas afetadas

| Camada | Arquivo | Ação |
|--------|---------|------|
| Domain | `apps/backend/domain/validation/abertura.go` (linha 236) | EDIT — `v.add(nil, ...)` → `v.addFatal(nil, ...)` em `ValidarAberturaDraft` |
| Domain | `apps/backend/domain/validation/alteracao.go` (linha 217) | EDIT — `v.add(nil, ...)` → `v.addFatal(nil, ...)` em `ValidarAlteracaoDraft` |

### Risco

Baixo. A mudança só adiciona issues que os tests já esperam; nenhum teste existente
de `domain/validation`, `domain/service` ou `adapter/web` depende do comportamento
bugado (a suíte inteira só falha nestes 3 casos). Testes de integração do worker
(`infrastructure`, Floci) não enviam chaves de topo desconhecidas em drafts.

## Critérios de aceite

- [ ] `TestRascunhoService_Salvar` verde (subteste `chave_de_topo_desconhecida` incluído)
- [ ] `TestAlteracaoRascunhoService_Salvar` verde (subteste `chave_de_topo_desconhecida` incluído)
- [ ] `TestPostDraft` verde (subteste `chave_de_topo_desconhecida → 400 com corpo do Node`)
- [ ] `make -C apps/backend test` e `make -C apps/backend test-integration` **100% verdes**
      (nenhuma outra falha — estes 3 são as únicas falhas conhecidas do repo)
- [ ] Gates do escopo tocado verdes (ver tabela em `.claude/commands/done.md`):
  - `apps/backend/**` → `make -C apps/backend lint` + `make -C apps/backend test` + `docker compose build api-go`
- [ ] Sem alteração em `domain/validation/testdata` (caracterização intacta)

## Notas

- Diagnosticado durante o `/done` do spec 039 (2026-10-08), quando a comparação com
  `main` provou que as 3 falhas pré-existiam (`git` limpo em `02d07c4` com as mesmas
  falhas).
- Mensagem de issue gerada: `Unrecognized key(s) in object: 'foo'` (mesma forma do
  Zod/Node que o front exibe).
- Se a correção revelar que outros no-ops de draft existem (checar call sites de
  `v.add` com `draft=true`), registrar aqui antes de ampliar o escopo.
