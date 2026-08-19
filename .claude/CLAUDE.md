# Regras do Agente

## Principios Fundamentais

- **Simplicidade Primeiro**: cada mudanca deve ser o mais simples possivel, tocando o minimo de codigo
- **Sem Preguica**: encontrar causas raiz, sem fixes temporarios — padrao de desenvolvedor senior
- **Orientado por Spec**: sem implementacao sem spec aprovada (exceto hotfixes triviais)
- **Small Batches**: quebrar trabalho em pecas digestiveis, entregar frequentemente
- **Usuario Controla o Git**: nunca executar comandos de escrita no git — sugerir, nao agir

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

### 7. Execucao de Tasks — Uma por Uma
- Trabalhar em **uma task do `todo.md` por vez** — nao iniciar a proxima antes de concluir a atual
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
3. **Iniciar batch**: `/start-batch [spec]` — cria `.claude/tasks/todo.md` a partir da spec
4. **Implementar**: seguir o checklist, marcar progresso com `[/]` (em andamento) e `[x]` (concluido)
5. **Explicar mudancas**: resumo de alto nivel a cada passo
6. **Capturar licoes**: atualizar `.claude/tasks/lessons.md` apos correcoes
7. **Finalizar**: `/done` — verifica testes, atualiza lessons, gera walkthrough e limpa

### Regras de Small Batches

- **Uma spec = maximo 1 dia de trabalho**
- Features grandes devem ser quebradas em multiplas specs sequenciais
- Cada spec tem `depends_on` para garantir ordem
- Nunca implemente sem spec aprovada (exceto hotfixes triviais)

### Estrutura do `.claude/`

```
.claude/
├── CLAUDE.md              # Este arquivo
├── specs/                 # Definicoes de features (spec-first)
│   ├── README.md
│   ├── _template.md
│   └── NNN-nome.md
├── tasks/                 # Gestao de trabalho
│   ├── README.md
│   ├── lessons.md         # Acumulativo — nunca resetar
│   └── todo.md            # Batch atual — criado/removido por batch
├── commands/              # Slash commands reutilizaveis
│   ├── new-spec.md
│   ├── start-batch.md
│   └── done.md
├── skills/                # Instrucoes step-by-step (agente le e segue)
│   ├── new-entity.md      # Criar entity de dominio
│   ├── new-port.md        # Criar port (interface ABC)
│   └── new-adapter.md     # Implementar adapter concreto
└── agents/                # Subagentes autonomos (delegacao)
    └── code-reviewer.md   # Revisao contra Clean Architecture
```

### Skills e Agents

**Skills** — o agente le e executa no contexto atual (mantem contexto do batch):
- `new-entity` → entity + testes unitarios
- `new-port` → interface ABC outbound (repository, gateway, client)
- `new-adapter` → adapter concreto + schema + registro no container + testes

**Agents** — delegacao para subagente isolado (contexto fresco):
- `code-reviewer` → revisa mudancas contra regras de Clean Architecture antes de fechar batch

---

## Arquitetura Clean — Regras de Dependencia

```
adapters --> domain <-- use_cases
infra --> adapters, domain, use_cases
```

## Comandos Git — Proibidos

> **NUNCA execute comandos de escrita no Git de forma proativa.** O usuario e o unico responsavel por gerenciar o repositorio.

Comandos **proibidos** para qualquer agente:

| Proibido | Motivo |
|----------|--------|
| `git commit` | Usuario decide o que e quando comitar |
| `git push` | Usuario decide quando subir |
| `git merge` | Usuario decide estrategia de merge |
| `git rebase` | Usuario decide estrategia de rebase |
| `git cherry-pick` | Usuario decide o que aplicar |
| `git tag` | Usuario decide versionamento |
| `git reset --hard` | Risco de perda de dados |
| `git clean -fd` | Risco de perda de arquivos |

Os commandos de escrita so podem ser executados com devida autorização expressa do usuario.

Comandos **permitidos** (somente leitura):

- `git status`, `git diff`, `git log`, `git branch`, `git show`
- `git stash list`, `git remote -v`

> Se precisar sugerir uma operacao git, **informe o comando ao usuario** e deixe ele executar.
