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
   - Testes de integração (`make -C apps/backend test-integration`) só quando nenhuma outra
     worktree está com o stack de pé
   - Gate vermelho: **pare**, corrija e rode de novo — não prossiga para o push
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
