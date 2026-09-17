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
   - `EnterWorktree` com `name: "spec/NNN-slug-da-spec"`
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
**uma worktree por vez**. Antes de subir o stack, verifique se outra worktree já o tem de pé.

## Input esperado

O usuário deve fornecer: `/start-batch [nome-ou-número-da-spec]`

Exemplo: `/start-batch 031-comentarios-concisos`
