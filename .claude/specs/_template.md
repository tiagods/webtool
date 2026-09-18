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

## Blocos

> Opcional — só quando a spec vai rodar em paralelo (`/start-batch NNN --parallel`).
> Regras em `.claude/rules/execucao-paralela.md`: `owns` disjuntos entre blocos, `needs` aponta
> para sinais (`@nome`) que algum bloco `emite`, sem ciclo. Apague a seção se for sequencial.

| # | Bloco | owns | needs | emite | agente |
|---|-------|------|-------|-------|--------|
| B1 | Contratos: entity + ports | `apps/backend/domain/entity/...`, `apps/backend/domain/ports/**` | — | `@ports` | claude |
| B2 | Service | `apps/backend/domain/service/...` | `@ports` | `@service` | claude |
| B3 | Infra / repositório | `apps/backend/infrastructure/aws/...` | `@ports` | — | claude |

## Critérios de aceite

- [ ] ...
- [ ] ...
- [ ] Gates do escopo tocado verdes (ver tabela em `.claude/commands/done.md`):
  - `apps/backend/**` → `make -C apps/backend lint` + `make -C apps/backend test` + `docker compose build api-go`
  - `apps/web/**`, `packages/**` → `npm run lint` + `npm run build`
  - só `.claude/**`, `docs/**`, `*.md` → sem gate de build

## Notas

> Decisões, trade-offs, referências.
