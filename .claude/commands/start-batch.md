Inicie um novo batch de trabalho a partir de uma spec aprovada, numa worktree isolada.

## Instruções

1. Leia a spec indicada pelo usuário em `.claude/specs/[spec].md`
2. Verifique que o `status` é `approved`. Se não for, avise o usuário e pare
3. **Avalie as dependências — sem gate rígido:**
   | Situação | Ação |
   |----------|------|
   | `depends_on` com status `done` | segue |
   | `depends_on` com status `rejected` | **conta como satisfeita** (a spec foi descartada); proponha limpar o campo |
   | `depends_on` em `draft`/`review`/`in-progress` | **avise e siga**; compare os globs de `touches` das duas specs e relate a colisão, se houver |
   | `prefer_after` em qualquer status | apenas informativo — nunca bloqueia |
   Só pare de fato quando a mudança **não compila ou não faz sentido** sem a dependência — e então escreva o motivo concreto, não "depends_on não está done"
4. **Abra a worktree do batch** (isolamento obrigatório — batches rodam em paralelo):
   - `git fetch origin` (a worktree nasce de `origin/main`, conforme `worktree.baseRef` em `.claude/settings.json`)
   - **Caminho padrão:** `EnterWorktree` com `name: "spec/NNN-slug-da-spec"`
   - **A worktree já existe** (o usuário criou na mão, ou sobrou de um batch anterior):
     `EnterWorktree` com `path: "<caminho>"` — o caminho precisa aparecer em `git worktree list`.
     Anote que, entrando assim, o `/done` **não** poderá removê-la pelo tool (ver `done.md`)
   - **Sem o tool** (sessão sem `EnterWorktree`, ou o usuário prefere na mão):
     ```bash
     git worktree add -b spec/NNN-slug .claude/worktrees/spec/NNN-slug origin/main
     cd .claude/worktrees/spec/NNN-slug
     ```
     O `symlinkDirectories` do settings não se aplica nesse caminho — rode `npm install` se a
     spec tocar `apps/web` ou `packages/*`
   - confirme com `git worktree list` e `git branch --show-current`
   - se a spec toca `apps/web` ou `packages/*` e o symlink de `node_modules` não resolveu, rode `npm install`
5. Atualize o status da spec para `in-progress`
6. Crie `.claude/tasks/todo.md` **dentro da worktree** (é gitignorado — estado efêmero do batch):
   - Título do batch referenciando a spec
   - Checklist detalhado derivado dos critérios de aceite e do design da spec
   - Itens granulares (um por arquivo/componente a criar/modificar)
7. Leia `.claude/tasks/lessons.md` e revise lições relevantes
8. Apresente o todo.md ao usuário e peça confirmação antes de começar a implementar

## Paralelismo

Vários batches podem estar abertos ao mesmo tempo, um por worktree — `git worktree list` é o
board. O que **não** é paralelizável: o stack local (`npm run infra:up`, `npm run dev`,
`make -C apps/backend test-integration`) usa `container_name` e portas fixas, então roda em
**uma worktree por vez**.

Antes de qualquer `infra:up`, rode **`npm run infra:owner`** — ele lê o label
`com.docker.compose.project.working_dir` que o Compose grava e diz de quem é a stack.

**Encontrar a stack ocupada não interrompe o batch.** Editar código, `npm run lint`,
`make -C apps/backend test` e commitar não tocam o Docker; só `infra:up`, `npm run dev` e
`test-integration` ficam adiados.

| Estado da stack | `infra:up` | `infra:down` |
|-----------------|-----------|--------------|
| livre / dona é esta worktree | segue | segue |
| dona é outra, containers **parados** | recusa; `infra:down` libera os nomes | limpa (lixo, não interrompe ninguém) |
| dona é outra, **no ar** | recusa e nomeia a dona | recusa — a decisão é do usuário |

Se o batch precisar do gate de integração e a stack estiver de pé por outra worktree, o `/done`
tem um desfecho próprio (**bloqueado**, sem push) — ver `.claude/commands/done.md`.

## Input esperado

O usuário deve fornecer: `/start-batch [nome-ou-número-da-spec]`

Exemplo: `/start-batch 031-comentarios-concisos`
