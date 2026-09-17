Finalize o batch atual: prove a conclusão, submeta e feche a worktree.

## Instruções

1. Leia `.claude/tasks/todo.md` e verifique que todos os itens estão `[x]`
   - Se houver itens pendentes, liste-os e pergunte se devem ser descartados ou completados
2. **Execute os gates do escopo tocado** (`git diff --stat origin/main...HEAD` diz quais são):
   | Escopo tocado | Gate |
   |---------------|------|
   | `apps/backend/**` | `make -C apps/backend lint` + `make -C apps/backend test` + `docker compose build api-go` |
   | `apps/web/**`, `packages/**` | `npm run lint` + `npm run build` |
   | somente `.claude/**`, `docs/**`, `*.md` | sem gate de build |
   - Gate vermelho: **pare**, corrija e rode de novo — não prossiga para o push
2b. **Gate de integração** (`make -C apps/backend test-integration`) — exigido **somente quando o
   diff toca `apps/backend/infrastructure/aws/**`** (é onde vivem os testes `//go:build
   integration`). Quando exigido, ele precisa do Floci de pé; rode `npm run infra:owner` antes:
   | Estado da stack | Ação |
   |-----------------|------|
   | livre | `npm run infra:up` e rode o gate |
   | dona é esta worktree | rode o gate |
   | dona é outra, containers **parados** | `npm run infra:down` (limpa os nomes), sobe e roda |
   | dona é outra, **no ar** | **desfecho bloqueado** (abaixo) — nunca derrube a stack alheia |

   **Desfecho bloqueado:** pare aqui. Não pushe, não abra PR, **não** marque a spec como `done`;
   mantenha a worktree e o `todo.md` como estão e relate:
   `bloqueado: aguardando a stack, dona = <worktree>`. Os commits já estão na branch da spec, então
   nada se perde — o usuário roda `/done` de novo quando a stack liberar.
3. Marque os critérios de aceite atendidos na spec e atualize-a para `status: done`
4. **Commits organizados** (nunca `git add .` / `-A` / `commit -am`):
   - `git status` + `git diff --stat` dos paths que vão entrar
   - um commit por unidade lógica, com `git add` de caminhos explícitos
   - Conventional Commits + rodapé `Spec: NNN`
5. Pergunte ao usuário:
   - "Houve algum erro, surpresa ou lição durante este batch?"
   - Se sim, adicione a lição em `.claude/tasks/lessons.md` no formato padrão
6. **Push + PR** — somente com as quatro condições da Convenção de Git satisfeitas
   (todo `[x]`, critérios `[x]`, gates verdes, `status: done`):
   - `git push -u origin spec/NNN-slug`
   - `gh pr create` — título `NNN — titulo da spec`; corpo com objetivo, critérios de aceite
     atendidos, como testar e gates executados
7. Gere um resumo do que foi feito (walkthrough):
   - Arquivos criados/modificados
   - Decisões tomadas
   - Testes adicionados
8. Remova `.claude/tasks/todo.md` (o batch está encerrado)
9. **Feche a worktree**: `ExitWorktree` com `action: "remove"`
   - Se sobrou trabalho não commitado ou fora do PR, use `action: "keep"` e informe o caminho
     da worktree ao usuário
10. Informe: "Batch finalizado, PR aberto. Pronto para a próxima spec."

## Input esperado

O usuário deve fornecer: `/done`
