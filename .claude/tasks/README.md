# Tasks — Gestão de Trabalho

## Arquivos

| Arquivo | Propósito | Ciclo de vida |
|---------|-----------|---------------|
| `todo.md` | Checklist do batch atual | Um por worktree, **gitignorado**; criado no `/start-batch`, removido no `/done` |
| `lessons.md` | Lições aprendidas | Acumulativo, nunca é resetado |

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

## Formato do todo.md

```markdown
# Batch: [ID e título da spec]

- [ ] tarefa pendente
- [/] tarefa em progresso
- [x] tarefa concluída
  - sub-item se necessário
```

## Formato do lessons.md

```markdown
## [Data] — [Contexto]

**Erro**: o que aconteceu
**Causa raiz**: por que aconteceu
**Regra**: o que fazer diferente no futuro
```
