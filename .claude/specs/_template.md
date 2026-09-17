---
id: "NNN"
title: ""
status: draft          # draft | review | approved | in-progress | done | rejected
created: YYYY-MM-DD
author: ""
batch_size: "small"    # small (≤ meio dia) | medium (≤1 dia)
depends_on: []         # HARD - sem estas specs a mudanca nao compila/nao faz sentido
prefer_after: []       # ordem preferida - apenas avisa, nunca bloqueia
touches: []            # globs dos paths que a spec altera - detecta colisao entre worktrees
---

# [Título da Spec]

## Contexto

> Por que essa mudança é necessária? Qual problema resolve?

## Objetivo

> O que vai ser construído? Escopo claro e limitado.

## Fora de escopo

> O que NÃO será feito nesta spec (evita scope creep).

- ...

## Design

> Como será implementado? Quais camadas são afetadas?

### Camadas afetadas

| Camada | Arquivo | Ação |
|--------|---------|------|
| Domain | `src/domain/entities/...` | CREATE |
| Ports  | `src/domain/ports/outbound/...` | CREATE |
| Adapters | `src/adapters/outbound/...` | CREATE |

### Contratos / Interfaces

```python
# Cole aqui as interfaces/contratos principais
```

## Critérios de aceite

- [ ] ...
- [ ] ...
- [ ] Gates do escopo tocado verdes (ver tabela em `.claude/commands/done.md`):
  - `apps/backend/**` → `make -C apps/backend lint` + `make -C apps/backend test` + `docker compose build api-go`
  - `apps/web/**`, `packages/**` → `npm run lint` + `npm run build`
  - só `.claude/**`, `docs/**`, `*.md` → sem gate de build

## Notas

> Decisões, trade-offs, referências.
