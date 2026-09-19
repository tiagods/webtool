# Regras do Agente

## Principios Fundamentais

- **Simplicidade Primeiro**: cada mudanca deve ser o mais simples possivel, tocando o minimo de codigo
- **Sem Preguica**: encontrar causas raiz, sem fixes temporarios — padrao de desenvolvedor senior
- **Orientado por Spec**: sem implementacao sem spec aprovada (exceto hotfixes triviais)
- **Small Batches**: quebrar trabalho em pecas digestiveis, entregar frequentemente
- **Git Organizado**: o agente opera o git normalmente (commit, branch, push, PR[sempre perguntar se deseja abrir ou fazer o merge da branch atual para a main]) seguindo a Convencao de Git — commits pequenos, por escopo, nunca globais

---

## Comportamento do Agente

### 1. Modo Planejamento por Padrao
- Entrar em modo planejamento para QUALQUER tarefa nao-trivial (3+ passos ou decisoes arquiteturais)
- Se algo der errado, PARAR e replanejar imediatamente — nao continuar forcando
- Usar modo planejamento para etapas de verificacao, nao apenas construcao
- Escrever specs detalhadas antecipadamente para reduzir ambiguidade

### 2. Estrategia de Subagentes
- Usar subagentes liberalmente para manter a janela de contexto principal limpa
- Delegar pesquisa, exploracao e analise paralela para subagentes
- Para problemas complexos, investir mais computacao via subagentes
- Uma tarefa por subagente para execucao focada
- **Implementacao tambem se delega**: uma spec pode rodar com **um subagente por bloco** dentro
  da mesma worktree — protocolo em [`rules/execucao-paralela.md`](rules/execucao-paralela.md).
  O `/start-batch` **sempre** aplica o teste de §1 e diz se o batch e paralelo ou sequencial;
  nao esperar o usuario pedir

### 3. Ciclo de Auto-Melhoria
- Apos qualquer correcao do usuario: atualizar `tasks/lessons.md` com o padrao
- Escrever regras para si mesmo que previnem o mesmo erro
- Iterar implacavelmente nessas licoes ate a taxa de erros cair
- Revisar licoes no inicio de cada sessao

### 4. Verificacao Antes de Concluir
- Nunca marcar uma tarefa como completa sem provar que funciona
- Comparar comportamento entre main e suas mudancas quando relevante
- Perguntar-se: "Um engenheiro senior aprovaria isso?"
- Rodar testes, verificar logs, demonstrar corretude

### 5. Exigir Elegancia (Equilibrado)
- Para mudancas nao-triviais: pausar e perguntar "existe uma forma mais elegante?"
- Se um fix parece gambiarra: "Sabendo tudo que sei agora, implementar a solucao elegante"
- Pular isso para fixes simples e obvios — nao over-engineer
- Desafiar seu proprio trabalho antes de apresentar

### 7. Execucao de Tasks — Uma por Uma Dentro da Linha de Execucao
- Trabalhar em **uma task por vez dentro de cada linha de execucao** — nao iniciar a proxima
  antes de concluir a atual. Batches diferentes rodam em paralelo, um por worktree; **dentro de
  um batch**, blocos de `owns` disjuntos rodam em paralelo, um subagente cada
- Um bloco consumidor **nao espera o bloco produtor terminar**: arranca assim que o **artefato**
  de que depende existe (sinal em `.claude/tasks/signals/`)
- Ao concluir cada task: **atualizar imediatamente o `todo.md`** marcando o item como `[x]`
- Nunca acumular tasks concluidas para marcar depois — marcar no momento exato da conclusao
- Ao iniciar uma task: marcar com `[/]` (em andamento) para sinalizar progresso
- Ao concluir **todos** os items de um criterio de aceite da spec: **marcar o criterio como `[x]` na spec** (`.claude/specs/NNN-*.md`) — manter spec e todo.md sempre sincronizados

### 6. Correcao Autonoma de Bugs
- Quando receber um bug report: apenas corrigir, sem pedir orientacao
- Apontar logs, erros, testes falhando — e resolver
- Zero troca de contexto necessaria do usuario
- Corrigir testes de CI falhando sem precisar ser orientado

---

## Workflow Spec-First

O projeto segue desenvolvimento **spec-first** com **small batches**.

### Ciclo de Desenvolvimento

```
Spec (definicao) → Aprovacao → Batch (implementacao) → Verificacao → Done
```

1. **Criar spec**: `/new-spec [nome]` — cria spec a partir do template em `.claude/specs/`
2. **Revisar e aprovar**: discutir design, marcar `status: approved`
3. **Iniciar batch**: `/start-batch [spec]` — abre a **worktree da spec** (`EnterWorktree`) e
   cria o `.claude/tasks/todo.md` dela
4. **Implementar**: seguir o checklist, marcar progresso com `[/]` (em andamento) e `[x]` (concluido)
5. **Explicar mudancas**: resumo de alto nivel a cada passo
6. **Capturar licoes**: atualizar `.claude/tasks/lessons.md` apos correcoes
7. **Finalizar**: `/done` — roda os gates do escopo, commita, pusha, abre o PR, gera walkthrough
   e fecha a worktree

### Regras de Small Batches

- **Uma spec = maximo 1 dia de trabalho**
- Features grandes devem ser quebradas em multiplas specs sequenciais
- **Um batch por worktree** — varios batches podem estar abertos ao mesmo tempo; `git worktree
  list` e o board. O stack local (`infra:up`, `dev`, `test-integration`) e a excecao: uma
  worktree por vez, porque `container_name` e portas sao fixas
- `depends_on` e **hard** (sem isso nao compila); `prefer_after` apenas avisa; dependencia
  `rejected` conta como satisfeita — ver `.claude/specs/README.md`
- Nunca implemente sem spec aprovada (exceto hotfixes triviais)

### Estrutura do `.claude/`

```
.claude/
├── CLAUDE.md              # Este arquivo
├── settings.json          # worktree.baseRef + permissoes (commitado)
├── specs/                 # Definicoes de features (spec-first)
│   ├── README.md
│   ├── _template.md
│   └── NNN-nome.md
├── rules/                 # Regras de codigo e de execucao
│   ├── boas-praticas.md
│   ├── boas-praticas-go.md
│   └── execucao-paralela.md  # Blocos, sinais e despacho de subagentes
├── tasks/                 # Gestao de trabalho
│   ├── README.md
│   ├── lessons.md         # Acumulativo — nunca resetar
│   ├── todo.md            # Batch atual (ou mapa de blocos) — gitignorado
│   ├── blocks/            # Checklist por bloco, modo paralelo — gitignorado
│   └── signals/           # Artefatos prontos, modo paralelo — gitignorado
├── worktrees/             # Uma worktree por batch (gitignorado)
│   └── spec/NNN-slug/
├── commands/              # Slash commands reutilizaveis
│   ├── new-spec.md
│   ├── start-batch.md
│   └── done.md
├── skills/                # Instrucoes step-by-step (agente le e segue)
└── agents/                # Subagentes autonomos (delegacao)
    └── code-reviewer.md   # Revisao contra Clean Architecture
```
**Agents** — delegacao para subagente isolado (contexto fresco):
- `code-reviewer` → revisa mudancas contra regras de Clean Architecture antes de fechar batch

---

## Arquitetura Clean — Regras de Dependencia

```
adapters --> domain <-- use_cases
infra --> adapters, domain, use_cases
```

---

## Convencao de Git

O agente opera o git livremente dentro desta convencao — `commit`, `branch`, `push`,
`merge`, `rebase`, PR — sem pedir permissao.

**Unica protecao: perda de dados.** Comandos que descartam trabalho de forma irrecuperavel
exigem **confirmacao explicita do usuario** antes de rodar:

- `git reset --hard`
- `git clean -fd`
- `git checkout -- <path>` / `git restore <path>` (descarta alteracao nao commitada)
- `git push --force` / `-f` (sobrescreve commits no remoto)
- `git branch -D` de branch nao mergeada
- `git stash drop` / `git stash clear`
- qualquer `git filter-*`

### Branch

- Uma branch por spec, **numa worktree isolada**: o `/start-batch` chama `EnterWorktree` com
  `name: "spec/NNN-slug-da-spec"`, que cria a branch a partir de `origin/main`
  (`worktree.baseRef: fresh` em `.claude/settings.json`) em `.claude/worktrees/`
- `EnterWorktree`/`ExitWorktree` sao **atalho, nao dependencia**: o que eles criam e uma worktree
  git comum. O equivalente manual e
  `git worktree add -b spec/NNN-slug .claude/worktrees/spec/NNN-slug origin/main` para abrir e
  `git worktree remove <caminho>` + `git branch -d <branch>` para fechar — o `ExitWorktree` so
  remove worktree que ele mesmo criou na sessao. Ver `start-batch.md` e `done.md`
- Fora de spec: `fix/descricao-curta`, `chore/descricao-curta`
- Nao implementar direto na `main` — batches paralelos em `main` disputam a mesma arvore
- A worktree nasce de `origin/main`: trabalho **nao commitado nao e herdado**. Commite ou
  descarte antes de abrir o batch

### Commits — organizados, nunca globais

- **Proibido commit global**: sem `git add .`, sem `git add -A`, sem `git commit -am`
- Sempre `git add` com **caminhos explicitos** dos arquivos daquela unidade de trabalho
- **Um commit = uma unidade logica** — uma task do `todo.md`, um bloco ou um criterio de aceite
- **No modo paralelo, so o orquestrador commita.** Subagente de bloco nao roda nenhum comando
  git: a worktree e compartilhada, o `.git/index.lock` e um so e um commit concorrente
  misturaria blocos. O orquestrador commita cada bloco quando ele conclui
- Se a arvore tem mudancas de mais de uma spec, **separar por caminho**; nunca misturar
  duas specs no mesmo commit
- Antes de cada commit: `git status` + `git diff --stat` dos paths que vao entrar, para
  confirmar o que esta sendo incluido
- Conventional Commits: `tipo(escopo): descricao no imperativo`
  - tipos: `feat` `fix` `refactor` `docs` `test` `chore` `build`
  - escopo: `backend` `web` `shared` `infra` `specs` `deps`
  - corpo (quando necessario) explica o **porque**; rodape referencia a spec: `Spec: 031`
- Commits gerados pelo agente levam o rodape de atribuicao
  `Co-Authored-By: Claude <modelo> <noreply@anthropic.com>`

### Push — so com a spec comprovadamente concluida

Durante o batch os commits ficam **locais**. O push acontece **uma vez**, no `/done`, e
somente quando as quatro condicoes estao satisfeitas:

1. Todos os itens do `todo.md` marcados `[x]`
2. Todos os criterios de aceite da spec marcados `[x]`
3. Gates do escopo tocado **executados e verdes** (prova de conclusao — nao basta afirmar)
4. `status: done` na spec e `todo.md` finalizado/removido

- Push na branch da spec, nunca direto na `main`
- Faltando qualquer condicao: **nao dar push** — reportar o que falta e parar
- **"Bloqueado aguardando a stack" e um desfecho legitimo do `/done`**: quando o gate de
  integracao e exigido (o diff toca `apps/backend/infrastructure/aws/**`) e a stack Docker esta
  de pe por outra worktree, o batch para antes do push, a spec **nao** vira `done` e a worktree
  fica aberta. Os commits ja estao na branch; o `/done` roda de novo quando a stack liberar
- `--force-with-lease` apenas na propria branch da spec, e so com confirmacao (perda de dados)

### Pull Request

- Abrir o PR ao fechar a spec (`/done`), da branch da spec para a `main`
- Titulo: `NNN — titulo da spec`
- Corpo: objetivo, criterios de aceite atendidos, como testar, gates executados
- **Ao fechar o PR, submeter as mudancas de forma organizada**: historico revisado antes do
  merge (commits agrupados por unidade logica, sem "wip"/"fix typo" soltos), merge na `main`
  e branch removida depois
