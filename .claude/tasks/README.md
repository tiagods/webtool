# Tasks — Gestão de Trabalho

## Arquivos

| Arquivo | Propósito | Ciclo de vida |
|---------|-----------|---------------|
| `todo.md` | Checklist do batch atual (ou o **mapa de blocos**, no modo paralelo) | Um por worktree, **gitignorado**; criado no `/start-batch`, removido no `/done` |
| `blocks/<ID>.md` | Checklist de um bloco — dono exclusivo é o subagente daquele bloco | Só no modo paralelo; gitignorado, removido no `/done` |
| `signals/<nome>` | Sinal de artefato pronto (libera os blocos que o declaram em `needs`) | Só no modo paralelo; gitignorado, removido no `/done` |
| `lessons.md` | Lições aprendidas | Acumulativo, nunca é resetado |

**Por que checklist separado por bloco:** vários subagentes escrevendo o mesmo `todo.md` se
sobrescrevem. Cada bloco escreve só o seu arquivo; o `todo.md` (o mapa) é escrito **apenas** pelo
orquestrador.

## Fluxo

1. **Spec aprovada** → `/start-batch [spec]` abre a worktree da spec e cria o `todo.md` dela
2. **Durante o batch** → itens são marcados `[/]` (em progresso) e `[x]` (feito)
3. **Batch finalizado** → `/done` roda os gates, commita, pusha, abre o PR e atualiza `lessons.md`
4. **`todo.md` é removido** e a worktree é fechada (`ExitWorktree`)

## Batches em paralelo

Cada batch vive em sua própria worktree (`.claude/worktrees/spec/NNN-slug`), então cada um tem
seu próprio `todo.md` sem colidir com os outros — não existe arquivo de board, **`git worktree
list` é o board**. Como o `todo.md` é gitignorado, nenhum merge de branch de spec conflita nele.

Exceção ao paralelismo: o stack local (`npm run infra:up`, `npm run dev`,
`make -C apps/backend test-integration`) usa `container_name` e portas fixas — uma worktree por vez.

## Formato do todo.md — sequencial

```markdown
# Batch: [ID e título da spec]

- [ ] tarefa pendente
- [/] tarefa em progresso
- [x] tarefa concluída
  - sub-item se necessário
```

## Formato do todo.md — paralelo (mapa de blocos)

```markdown
# Batch: 032 — Rota de consulta de protocolo
Modo: paralelo · 4 blocos · worktree `.claude/worktrees/spec/032-consulta-protocolo`

| Bloco | Estado | needs | emite | Commit |
|-------|--------|-------|-------|--------|
| B1 contratos | [x] | — | `@ports` ✔ | `a1b2c3d` |
| B2 service | [/] | `@ports` ✔ | `@service` | — |
| B3 repositório | [/] | `@ports` ✔ | — | — |
| B4 handler + rota | [ ] | `@service` | — | — |
```

Estados: `[ ]` não despachado · `[/]` em voo · `[x]` concluído e commitado · `[!]` falhou.
O detalhe de cada bloco fica em `blocks/B1.md`, escrito pelo próprio subagente.

## Formato do lessons.md

```markdown
## [Data] — [Contexto]

**Erro**: o que aconteceu
**Causa raiz**: por que aconteceu
**Regra**: o que fazer diferente no futuro
```
