# Execução paralela de uma spec — blocos e subagentes

Complemento de [`.claude/CLAUDE.md`](../CLAUDE.md) para o modo `/start-batch NNN --parallel`:
**uma spec, uma worktree, vários subagentes**, cada um responsável por um bloco.

A regra "uma task por vez" do workflow sequencial continua valendo **dentro** de cada bloco.
O que o modo paralelo muda é que blocos diferentes avançam ao mesmo tempo, e um bloco
consumidor **não espera o bloco produtor terminar** — ele arranca assim que o artefato de que
precisa existe.

---

## 1. Quando chamar em paralelo — o teste, rodado sempre

O `/start-batch` **sempre** aplica este teste, com ou sem flag, e diz ao usuário o resultado
antes de criar o `todo.md`. A decisão nunca é "o usuário não pediu, então sequencial".

É paralelo quando **as quatro** respostas são sim:

| # | Pergunta | Corte |
|---|----------|-------|
| 1 | A spec cai em **≥ 2 partições de arquivos disjuntas**? | Se dois blocos disputam o mesmo arquivo, não são dois blocos |
| 2 | Cada partição tem **trabalho real** (≥ ~3 arquivos ou ≥ ~30 min)? | Bloco trivial custa mais em despacho e revisão do que rende |
| 3 | O acoplamento entre elas cabe em **contratos nomeáveis** (assinatura, interface, schema)? | Se não dá para nomear o sinal, a fronteira não existe |
| 4 | Os blocos passam sem **recurso exclusivo** (stack Docker, `npm run build`, `make generate`)? | Recurso exclusivo serializa tudo de novo |

Qualquer "não" → sequencial, e o motivo vai no relatório ("B2 e B3 escrevem o mesmo pacote").

**Sinais fortes de que é paralelo** (na prática, o gatilho mais comum):

- A spec tem uma tabela "Camadas afetadas" com **camadas distintas** — entity/ports, service,
  infrastructure, adapter/web são partições naturais e a Clean Architecture já garante a
  fronteira.
- A spec toca **apps diferentes** (`apps/backend` + `apps/web` + `packages/shared`).
- A spec é uma **varredura por arquivo** de regra uniforme (auditar comentários, renomear
  constantes por pacote, cobrir N handlers com teste) — aí cada bloco é um subconjunto dos
  arquivos, sem `needs` nenhum.
- `batch_size: medium` com 6+ arquivos no design.

A lista negativa está em §9. O usuário pode forçar em qualquer direção: `--parallel` ignora o
teste e paraleliza, `--seq` ignora e vai sequencial.

## 2. Vocabulário

| Termo | O que é |
|-------|---------|
| **Bloco** | Unidade despachável a um subagente. Tem `owns`, `needs`, `emite` e um checklist próprio |
| **`owns`** | Globs dos arquivos que **só aquele bloco** pode escrever. Disjuntos entre blocos |
| **`needs`** | Sinais que precisam existir antes de o bloco arrancar. Vazio = arranca na largada |
| **`emite`** | Sinais que o bloco publica assim que o artefato correspondente está pronto |
| **Sinal** | Arquivo em `.claude/tasks/signals/<nome>` — "este artefato existe e compila" |
| **Orquestrador** | A sessão principal. Monta o DAG, despacha, commita e fecha o batch |

## 3. As cinco invariantes

1. **`owns` disjuntos.** Dois blocos nunca escrevem o mesmo arquivo. Se precisariam, é **um**
   bloco só — não há merge entre blocos, eles dividem a mesma árvore.
2. **Escrita só dentro do `owns`; leitura é livre.** Precisou editar fora? O subagente **para**
   e reporta ao orquestrador; não invade.
3. **Git é do orquestrador.** Subagente não roda `add`, `commit`, `stash`, `checkout`,
   `restore`, `rebase` — a worktree é compartilhada, o `.git/index.lock` é um só e um commit
   concorrente misturaria blocos.
4. **Recurso exclusivo é do orquestrador**: `.next/`, `apps/backend/bin/`, `node_modules/`,
   `make generate`, `docker compose` e a stack local. Subagente verifica o **seu pacote**
   (`go build ./domain/service/...`, `gofmt -l`), nunca roda build que escreve em diretório
   compartilhado.
5. **Sinal só depois de verificado.** Emitir sinal de código que não compila trava todo o resto
   do DAG em cima de um contrato quebrado.

## 4. Sinal — a liberação por artefato

O ponto do modo paralelo: o consumidor espera o **artefato**, não o bloco.

```bash
# dentro da worktree, assim que o arquivo existe E o pacote compila
echo "B1 · domain/ports/outbound/ficha_repository.go · $(date -u +%FT%TZ)" \
  > .claude/tasks/signals/ports
```

- O produtor emite **no meio do seu trabalho**, assim que aquele artefato fica de pé — não no
  fim do bloco. É isso que corta a espera.
- O texto do sinal lista os paths que ficaram prontos; quem consome lê o arquivo para saber o
  que já pode importar.
- Um bloco pode emitir vários sinais em momentos diferentes (`@entity`, depois `@ports`).
- **Contrato instável não vira sinal.** Se a assinatura ainda pode mudar, ela é um bloco próprio
  (tipicamente `B1 — contratos`, curto) e os consumidores esperam o bloco inteiro.
- Ao terminar, o subagente garante que **todos** os sinais declarados em `emite` foram
  publicados. Sinal declarado e não emitido = bloco não concluído.

## 5. Declaração na spec

A spec aprovada traz a seção `## Blocos` (ver `_template.md`):

```markdown
## Blocos

| # | Bloco | owns | needs | emite | agente |
|---|-------|------|-------|-------|--------|
| B1 | Contratos: entity + ports | `apps/backend/domain/entity/ficha.go`, `apps/backend/domain/ports/**` | — | `@entity`, `@ports` | claude |
| B2 | Service | `apps/backend/domain/service/ficha*.go` | `@ports` | `@service` | claude |
| B3 | Repositório Dynamo | `apps/backend/infrastructure/aws/ficha*.go`, `apps/backend/infrastructure/aws/model/ficha*.go` | `@ports` | — | claude |
| B4 | Handler + presenter + rota | `apps/backend/adapter/web/**` | `@service` | — | claude |
| B5 | Testes de service | `apps/backend/domain/service/ficha*_test.go` | `@service` | — | claude |
```

Sem essa seção o `--parallel` não roda: o orquestrador propõe os blocos, o usuário aprova, a
seção entra na spec, aí despacha.

## 6. Ciclo do orquestrador

1. **DAG** — valida: `owns` disjuntos entre todos os blocos, todo `needs` tem um `emite`
   correspondente, sem ciclo. Colisão de `owns` = funde os dois blocos ou para.
2. **Largada** — despacha com `Agent` (`run_in_background: true`) todos os blocos de `needs`
   vazio.
3. **Espera** — `Monitor` num `until` sobre `.claude/tasks/signals/`, mais as notificações de
   subagente concluído. Nunca ficar em `sleep` cego.
4. **Liberação** — a cada sinal novo ou bloco concluído, recalcula quem ficou liberado e
   despacha. Não espera a "onda" fechar.
5. **Bloco concluído** — o orquestrador confere que a árvore só mudou dentro do `owns`
   (`git status --porcelain`), roda o gate escopado, **commita aquele bloco** (caminhos
   explícitos, Conventional Commits, rodapé `Spec: NNN`) e marca o mapa no `todo.md`.
6. **Fim** — com todos os blocos `[x]`, roda os gates completos do escopo e segue para `/done`.

**Teto de 4 blocos em voo.** Acima disso a contenção de disco/CPU e o ruído de relatório custam
mais do que o paralelismo rende.

## 7. Prompt do subagente

Todo despacho carrega, nesta ordem:

```
Worktree: <caminho absoluto> — trabalhe SOMENTE aqui.
Bloco <ID> — <título>, da spec <NNN> (.claude/specs/NNN-slug.md, leia a seção do seu bloco).

Leia antes de codar: .claude/CLAUDE.md, .claude/rules/boas-praticas.md,
.claude/rules/boas-praticas-go.md (se tocar Go), .claude/tasks/lessons.md.

Você PODE escrever em: <owns>
Já disponível (sinais satisfeitos): <lista de sinais + paths>
Seu checklist: .claude/tasks/blocks/<ID>.md — mantenha-o atualizado ([/] ao iniciar, [x] ao concluir).

PROIBIDO: qualquer comando git; escrever fora do seu `owns` (leitura é livre);
docker/`npm run dev`/`infra:*`/`make generate`; `npm run build`.
Precisou de algo fora do `owns` → pare e reporte, não invada.

Ao deixar <artefato> de pé e compilando, emita o sinal:
  echo "<ID> · <paths> · $(date -u +%FT%TZ)" > .claude/tasks/signals/<nome>

Antes de reportar concluído: <verificação escopada, ex. go build ./domain/service/... e gofmt -l>.

Relatório final: arquivos criados/modificados, sinais emitidos, verificação executada e sua
saída, e o que ficou de fora.
```

## 8. Quando um bloco falha

- O orquestrador **não despacha** os dependentes daquele sinal e **não mata** os blocos em voo
  de `owns` disjunto — eles não dependem do que quebrou.
- Reporta ao usuário o que falhou, com a saída real, e replaneja: reduzir o bloco, corrigir no
  próprio orquestrador ou redespachar.
- O trabalho parcial fica na árvore. **Nunca** desfazer com `git checkout --`/`restore`/`clean`
  sem confirmação explícita do usuário (regra de perda de dados).
- Bloco que travou esperando sinal que nunca vem: o orquestrador cancela o despacho e reporta o
  sinal ausente — não inventa o contrato no lugar do produtor.

## 9. Quando **não** paralelizar

- Spec de 1–2 arquivos, ou em que tudo cai no mesmo pacote (`owns` inevitavelmente colidem).
- Refactor amplo do tipo "renomear em toda a árvore" — um passe sequencial é mais barato e mais
  seguro que N agentes se cruzando.
- Batch cujo gate central é a stack Docker: ela é exclusiva, o paralelismo não ajuda.
- Na dúvida, sequencial. O modo paralelo paga só quando os blocos são de fato independentes.
