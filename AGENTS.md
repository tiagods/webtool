# AGENTS.md

Ponto de entrada para qualquer agente de código neste repositório (Claude Code, Cline, Codex,
Cursor, …). As regras canônicas **não** vivem aqui — este arquivo só aponta para elas, para não
existirem duas versões da mesma instrução.

## Leia nesta ordem

| Arquivo | O que define |
|---------|--------------|
| [`CLAUDE.md`](CLAUDE.md) | Visão geral do projeto: comandos, arquitetura do monorepo, arquivos-chave |
| [`.agents/CLAUDE.md`](.agents/CLAUDE.md) | Workflow do agente: ciclo spec-first, execução de tasks, convenção de git |
| [`.agents/rules/boas-praticas.md`](.agents/rules/boas-praticas.md) | Os 10 mandamentos de código |
| [`.agents/rules/boas-praticas-go.md`](.agents/rules/boas-praticas-go.md) | Clean Architecture e idiomas Go de `apps/backend` |
| [`.agents/rules/execucao-paralela.md`](.agents/rules/execucao-paralela.md) | Uma spec em blocos paralelos: um subagente por bloco, sinais, quem pode commitar |
| [`.agents/specs/`](.agents/specs/) | Uma spec por feature — nada é implementado sem spec aprovada |

`.agents/` é um link para `.claude/`: os dois caminhos levam ao mesmo lugar.

## Não negociáveis

- **Spec-first** — sem spec aprovada, sem implementação (exceto hotfix trivial)
- **Uma branch/worktree por spec** — batches paralelos não dividem a mesma árvore
- **Blocos paralelos dividem a worktree, não o git** — `owns` disjuntos e só o orquestrador commita
- **Commits nunca globais** — sem `git add .`, sem `-A`, sem `commit -am`; sempre caminhos explícitos
- **Push só com a spec comprovadamente concluída** — todo `[x]`, critérios `[x]`, gates verdes, `status: done`
- **Confirmação do usuário para perda de dados** — `reset --hard`, `clean`, `restore`, `push --force`, `branch -D`, `stash drop/clear`
- **Uma stack Docker por máquina** — `npm run infra:owner` diz de quem ela é

## Recriando os links (clone novo)

`.agents/` e `.clinerules/` são links locais, fora do versionamento. No Windows:

```powershell
New-Item -ItemType Junction -Path .agents -Target .claude
```

Em Linux/macOS:

```bash
ln -s .claude .agents
```
