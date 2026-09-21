# Lições Aprendidas

> Documento acumulativo. Nunca é resetado. Consultado no início de cada sessão.

<!-- Adicionar lições no formato abaixo -->
<!--
## [Data] — [Contexto]

**Erro**: o que aconteceu
**Causa raiz**: por que aconteceu
**Regra**: o que fazer diferente no futuro
-->

---

## 2026-07-02 — Ambiente Windows (Docker Desktop)

**Erro**: todo comando `docker` (Bash e PowerShell) ficou pendurado indefinidamente ("running in background", nunca retornava), inclusive comandos triviais como `docker inspect`.
**Causa raiz**: o motor do Docker Desktop estava fora do ar (`failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`) — não era um problema do comando em si nem do shell.
**Regra**: se **todo** comando `docker` travar (mesmo os mais simples, em shells diferentes), suspeitar do motor do Docker Desktop antes de tentar variações de sintaxe — rodar um comando não-Docker trivial (`echo`) para confirmar que o shell em si está saudável, depois pedir para o usuário verificar/reiniciar o Docker Desktop.

## 2026-09-07 — Spec 022 (Migração Go) — ambiente Go no Windows

**Erro**: `go version` retornava `cannot find GOROOT directory: C:\Go` — o comando `go` estava
inutilizável em todos os shells.
**Causa raiz**: variável de ambiente `GOROOT=C:\Go` obsoleta no ambiente (de uma instalação
antiga), enquanto o Go 1.27.1 real está em `C:\Program Files\Go`. Além disso `go` não está no
PATH do Git Bash nem do PowerShell.
**Regra**: para rodar comandos Go nesta máquina, prefixar sempre com
`$env:GOROOT='C:\Program Files\Go'; $env:PATH="C:\Program Files\Go\bin;$env:PATH"; $env:GOTOOLCHAIN='local'`
(PowerShell) e usar `go -C <dir> <cmd>` em vez de `cd`. Sugerir ao usuário remover a variável
`GOROOT` obsoleta (o Go não precisa dela quando instalado no diretório padrão) e adicionar
`C:\Program Files\Go\bin` ao PATH.

## 2026-09-07 — Spec 024 — `make` no Windows PowerShell usa cmd.exe nas receitas

**Erro**: `make lint` no PowerShell falhava em `fmt-check` com "'out' não é reconhecido como
um comando interno" — a receita usa sintaxe sh (`out="$(gofmt -l .)"; if [ -n ... ]`).
**Causa raiz**: o `make` do Chocolatey executa cada receita via `cmd.exe`, não `sh`.
**Regra**: rodar `make` (deste módulo Go) a partir do **Git Bash**, não do PowerShell.
No PowerShell, chamar os passos direto (`go vet ./...`, `gofmt -l .`, `golangci-lint run ./...`).

## 2026-09-07 — Spec 022 (Migração Go) — edição concorrente de outro device

**Erro**: o usuário editava `apps/api-golang` ao vivo de outro device enquanto o agente
implementava o mesmo batch — arquivos apareciam/mudavam entre um `find` e o seguinte,
quebrando o build repetidamente (`StartApp redeclared`, imports mortos).
**Regra**: quando `find`/`Read` revelar arquivos `.go` que o agente não criou, ou o
system-reminder avisar "file changed on disk", **parar de editar** e perguntar como coordenar
(ex.: "eu espero você terminar" vs "eu assumo"). Não tentar consertar edições in-progress do
usuário sem saber a intenção (nome de função, pacote alvo).
(CRLF: resolvido — `.gitattributes` com `* text=auto eol=lf` + `*.go text eol=lf` força LF;
ao diagnosticar `gofmt -l` "sem motivo aparente", ainda vale checar `grep -lU $'\r' <arquivo>`.)

## 2026-09-07 — Spec 025 (Validação Go) — importar schema `.ts` de `@prolink/shared` em script

**Contexto**: a suíte de caracterização (`scripts/gen-abertura-characterization.mjs`) precisa
rodar os schemas Zod reais de `packages/shared` contra payloads e gravar o veredito.
**Erro/beco**: `import ... from '@prolink/shared'` num `.mjs` falha — o pacote resolve para
`node_modules/@prolink/shared/src/index.ts` e o type-stripping do Node 24 **não** roda em
arquivos sob `node_modules` ("Stripping types is currently unsupported for files under
node_modules"). `tsx`/`ts-node` não estão instalados.
**Regra**: importar o schema pelo **caminho relativo direto** ao arquivo
(`../packages/shared/src/schemas/abertura.ts`, com a extensão `.ts` explícita) — fora de
`node_modules`, o type-stripping do Node 24 funciona, desde que o `.ts` só importe deps reais
(`zod`). Node ≥ 22.18 / 24 dispensa flag.

## 2026-09-07 — Spec 024 (Auth Go) — `go get` some com `go mod tidy` sem import

**Erro**: `go get github.com/golang-jwt/jwt/v5` adicionava a dep, mas o `go mod tidy`
seguinte a removia — depois `go build` falhava com "no required module provides package".
**Causa raiz**: `go mod tidy` poda toda dependência que nenhum `.go` do módulo importa.
Na spec eu tinha uma task "0.1 adicionar dep" antes das tasks que escrevem o código que a usa.
**Regra**: adicionar dependência Go **junto** do primeiro arquivo que a importa, não numa
task isolada anterior. Rodar `go get` + `go build` + `go mod tidy` na mesma leva.

## 2026-09-07 — Spec 024 — `Edit(replace_all)` com padrão sensível a whitespace corrompe arquivo

**Erro**: removi `defer resp.Body.Close()` de um teste com `replace_all` e o padrão
`"\n\t\tdefer resp.Body.Close()"`. Onde a indentação real era de 3 tabs, o replace comeu o
`\n` e mesclou linhas (`...)		if resp.StatusCode`), gerando erro de sintaxe em 5 pontos.
**Causa raiz**: `replace_all` casa a string literal exata; um padrão que embute newline +
indentação assumida diverge silenciosamente da indentação real em contextos aninhados.
**Regra**: para remover/alterar uma linha repetida em vários pontos de um arquivo, **reescrever
o arquivo com `Write`** ou fazer `Edit` pontual com contexto único por ocorrência — nunca
`replace_all` com padrão que depende de nível de indentação.

## 2026-07-02 — Spec 008 (Backend APIs) — `npm run build` mata o dev server

**Erro**: `npm run build` (produção) executado enquanto `npm run dev` estava rodando na mesma app quebrou o dev server (`.next` é compartilhado entre os dois; erro "Cannot find module './chunks/vendor-chunks/next.js'").
**Causa raiz**: dev e build gravam no mesmo diretório `.next`; rodar um build de produção por cima de um dev server ativo corrompe o cache/webpack-runtime dele.
**Regra**: nunca rodar `npm run build` para verificação enquanto o dev server da mesma app estiver de pé. Parar o dev server antes, ou rodar build antes de subir o dev server. Se corromper, `rm -rf apps/web/.next` e reiniciar o dev server resolve.

## 2026-07-07 / 2026-07-13 — `.partial()` do Zod é raso + salvar-antes-de-navegar deve propagar falha

**Erro**: `POST /api/draft` retornava 400 (`"Você precisa aceitar os termos de consentimento"`) em **todo** salvamento de rascunho antes do último passo, porque `documentosAceitos: z.boolean().refine(val => val === true)` estava no payload com valor `false` durante todos os passos anteriores. `aberturaFormDraftSchema = aberturaFormObjectSchema.strict().partial()` só torna a CHAVE opcional — não remove o `.refine()` quando o valor está presente. Como `saveDraft()` (`StepperEngine.tsx`) engolia o erro só com `console.error` e `handleNext` navegava mesmo com o salvamento falhando, o bug ficava invisível.
**Causa raiz**: `.partial()` do Zod é raso e não remove `.refine()`/constraints de campos presentes — só afeta a obrigatoriedade da chave existir. Idem: qualquer schema que passa por `.refine()`/`.superRefine()` deixa de ser `ZodObject` puro e perde `.partial()`/`.extend()`/`.pick()` (exportar o `z.object({...})` base **antes** do refine — ver `aberturaFormObjectSchema` vs `aberturaFormSchema`).
**Regra**: (1) ao criar uma variante "draft/partial" de um schema com campos que só fazem sentido como obrigatórios/`true` no passo final, sobrescrever esse campo via `.extend({ campo: z.tipo().optional() })` após o `.partial()`. (2) Toda função de "salvar progresso" antes de uma navegação deve retornar sucesso/falha, e o chamador deve **bloquear a navegação e avisar o usuário** se falhar — nunca só `console.error` e seguir em frente.

## 2026-09-02 — Spec 012 (Ficha de Alteração) — verificação E2E via Docker

**Erro 1 — imagens Docker desatualizadas**: `docker compose up -d` (sem `--build`) reusa a imagem existente; `POST /api/alteracao/*` retornava o HTML 404 do Next e o E2E parecia falhar por bug de código.
**Causa raiz**: `infra:up` no `package.json` é `docker compose up -d` puro — não rebuilda. Só `infra:reset` (`down -v && up`) ou `--build` explícito atualiza a imagem.
**Regra**: antes de qualquer verificação E2E via Docker, rebuildar as imagens das apps que mudaram (`docker compose build web api && docker compose up -d web api`) e **reiniciar o nginx** (`docker compose restart nginx` — ele resolve os upstreams por nome no startup e cacheia o IP; container recriado = IP novo). Confirmar que a rota nova existe no container: `docker exec prolink-api sh -c "ls /app/apps/api/.next/server/app/api/<rota>"`.

**Erro 2 — item órfão na tabela de Abertura**: `POST /api/alteracao/session` criava um item de rascunho na tabela `fichas-abertura` (além do correto em `fichas-alteracao`).
**Causa raiz**: a rota reusa `createOrGetSession`, que chamava `ensureRascunhoInicial(sessionId)` sem `tableName` → default = tabela de Abertura. A generalização da Spec 012 parametrizou `ensureRascunhoInicial`/`requireSession` por tabela, mas esqueceu `createOrGetSession`, que é o único ponto que faz o bootstrap do item para sessão nova.
**Regra**: ao adicionar um segundo formulário que reusa helpers de sessão/auth de um formulário existente, auditar **toda** a cadeia de chamadas do helper por parâmetros com default implícito para a tabela/recurso do formulário original — não só as funções citadas na spec. Verificação: rodar o fluxo do novo formulário e conferir que a contagem de itens da tabela do formulário antigo **não muda**.

## 2026-09-08 — Spec 029 (rename apps/backend) — `sed` de path com nomes que se contêm

**Erro/risco**: fazer `sed 's#apps/api\b#apps/backend#g'` em docs também casa o `apps/api` dentro
de `apps/api-node` e `apps/api-golang` (o `\b` casa entre `i` e `-`), corrompendo os nomes
compostos (gerou `git mv apps/backend apps/backend` numa nota de rollback).
**Regra**: quando um token de rename é prefixo de outros (`apps/api` ⊂ `apps/api-node` ⊂
`apps/api-golang`), fazer o `sed` em ordem: (1) placeholder nos nomes compostos
(`s#apps/api-node#§X§#g`), (2) tratar `apps/api-golang` explicitamente, (3) `apps/api/` e
`apps/api\b`, (4) restaurar o placeholder. E reler o diff dos arquivos tocados — `sed` em massa
sempre deixa 2–3 frases sem sentido que precisam de edição à mão.

## 2026-09-08 — Specs 022–029 nunca commitadas — commit em blocos coerentes ao finalizar

**Contexto**: toda a migração Go (022–027, `done`) + o cutover (028) estavam no working tree
sem nenhum commit — `apps/api/` inteiro *untracked*, mais mudanças alheias de outros devices
(`.claude/settings.json` deletado, specs 012/014/016 editadas, `.claude/rules/` novo).
**Regra**: antes de iniciar um batch que renomeia/apaga o que o anterior produziu, checar
`git log` — se o trabalho anterior não foi commitado, **parar e organizar os commits primeiro**
(um "checkpoint" por spec ou por bloco coerente), deixando de fora só o batch atual. Nunca
empilhar rename-sobre-rename de código *untracked*: perde-se a granularidade de `git revert` e
o diff fica ilegível. Mudanças de outros devices que aparecem no tree: não commitar às cegas —
listar para o usuário e deixar as ambíguas (ex.: arquivo deletado) fora dos commits.

## 2026-09-08 — Spec 028 (Cutover Go) — rename de diretório quebra Dockerfiles fora do módulo

**Erro**: após `git mv apps/api apps/api-node` + `mv apps/api-golang apps/api`, `docker compose build`
falhou em `web`: `"/apps/api/package.json": not found`. O `apps/web/Dockerfile` (e o do `api-node`)
copiam `apps/api/package.json` porque o `npm ci` de workspaces exige o `package.json` de **todos** os
workspaces — e o `package-lock.json` ainda listava o path antigo.
**Causa raiz**: um rename de diretório de workspace tem 3 pontas além do código: (1) `workspaces` no
`package.json` raiz, (2) `package-lock.json` (precisa `npm install` para regenerar), (3) todo `COPY`
de Dockerfile de OUTRO app que referencia o workspace renomeado.
**Regra**: ao renomear um diretório sob `apps/`, fazer um `grep -rn "apps/<nome-antigo>"` em
**todos** os `Dockerfile`, `package.json`, `*-lock.json`, `docker-compose*.yml`, `next.config.*`,
`tsconfig*` e scripts — não só no código do próprio app. Rodar `npm install` para sincronizar o lock
e `docker compose build` (sem cache implícito) como gate antes de declarar o rename concluído.

## 2026-09-08 — Spec 028 (Cutover Go) — verificar contrato antes de trocar o upstream

**Contexto**: provar que `apps/web` **sem uma linha alterada** funciona contra a API Go, antes do
rename definitivo `apps/api-golang` → `apps/api`.
**Abordagem que funcionou**: (1) editar só `infra/nginx/default.conf` (`proxy_pass … api-go:3001`),
rebuildar/reiniciar o nginx, rodar um E2E de contrato via `curl` por `http://localhost`
(aceite→session→draft→upload-url→submit, alteração, DELETE 403/409/200, rate-limit 429, e o
`verify-jwt-cross.mjs` no cookie `prolink_aceite`); (2) `git checkout` no nginx; (3) só então o
cutover, que devolve o nome `api` ao serviço Go e deixa o nginx **intocado**.
**Cuidado com o rate limit** (20 req/60s por IP cobre toda a `/api`): cada fluxo E2E via curl chega
perto do teto — `docker compose restart <api>` entre fluxos zera a janela in-memory. E o `curl`
honra o `Set-Cookie` de expiração do submit e **descarta** o cookie de sessão — para testar o 409
("sessão já enviada") é preciso salvar o jar ANTES do submit e reenviá-lo.
**Regra**: para um cutover de backend atrás de proxy, o teste de "cliente intocado funciona" é um
repoint temporário e revertido do upstream do proxy + E2E de contrato; não vale confiar só nos
testes unitários/caracterização. Guardar cookies pré-submit para exercitar caminhos pós-submit.

## 2026-07-13 — Spec 012 (Ficha de Alteração) — `FormLabel` fora de `FormField`

**Erro**: `StepIdentificacao.tsx` usava `<FormLabel>` como cabeçalho de uma seção ("Endereço Atual da Sede"), fora de qualquer `<FormField>`/`<FormItem>`. `npm run build` e `npm run lint` passaram (é só erro de runtime), mas a página quebrava (`Error: useFormField should be used within <FormField>`) assim que renderizada — só apareceu num smoke test manual do dev server.
**Causa raiz**: `components/ui/form.tsx` (`FormLabel`/`FormControl`/`FormMessage`/`FormDescription`) chamam `useFormField()`, que lança se não houver `FormFieldContext`/`FormItemContext` no pai — ou seja, só podem ser usados **dentro do `render` de um `<FormField>`**. Build e lint não capturam (erro puramente de runtime).
**Regra**: para cabeçalhos de seção/grupo que não são o rótulo de um campo específico, usar `<Label>` de `@/components/ui/label` (sem dependência de contexto) ou uma tag semântica (`<h3>`/`<h4>`), nunca `<FormLabel>`/`<FormControl>`/`<FormMessage>` fora de um `<FormField>`. Como isso não aparece no build/lint, **sempre validar páginas novas com formulário num dev server real** antes de declarar a fase concluída.

## 2026-09-17 — Spec 031 — critério de lint já vermelho no `origin/main`

**Erro**: a spec 031 exigia `golangci-lint run ./...` limpo, mas o baseline (`origin/main`) já tinha 10 issues (errcheck 4, revive 5, staticcheck 1). Os 5 de comentário foram corrigidos na 031 e os 5 de código viraram a spec 032 — a 031 só fecharia o gate depois da 032.
**Causa raiz**: o critério foi escrito sem rodar o gate no estado atual; o trabalho anterior (migração Go 022–028) deixou o lint vermelho e ninguém percebeu.
**Regra**: antes de aprovar uma spec, rodar os gates do escopo no baseline (`origin/main`) e colar a evidência na própria spec; se o gate já falha, tratar como dívida separada (spec própria), não como critério da spec nova.

## 2026-09-19 — Spec 030 — `next build` type-checa `*.test.tsx` (gate de build já vermelho)

**Erro**: o critério `npm run build -w apps/web` da 030 falhou com erro de tipo em `apps/web/mocks/handlers.ts` (`body: unknown` não atribuível a `JsonBodyType`) e em vários `*.test.tsx` de `forms-alteracao`. `npx tsc --noEmit -p apps/web/tsconfig.json` no `main` limpo reproduziu dezenas de erros — nenhum introduzido pela 030.
**Causa raiz**: o `tsconfig` de `apps/web` inclui `**/*.ts(x)`, então o `next build` faz type-check de testes e mocks; a spec 017 (testes unitários web, recém-mergeada) adicionou arquivos de teste com erros de tipo e derrubou o build de produção sem que ninguém rodasse o gate.
**Regra**: (1) `next build` de produção deve excluir `*.test.tsx`/`mocks/` do type-check (ou usar um `tsconfig.build.json` sem os testes) — dívida a tratar em spec/hotfix próprio; (2) antes de escrever critério de build, rodar `npx tsc --noEmit` no baseline, não só `npm test`/`npm run lint` (que não pegam erros de tipo nos testes).

## 2026-09-19 — Spec 030 — critérios de grep de PII largos demais

**Erro**: o critério final de PII casava `000.000.000-00` (máscara/placeholder aceito em F8) e `email@email.com` em `lib/termo.ts` (aceito em F5) — itens que a própria spec marcou como "aceitar". Um critério de grep sem as exceções aceitas nunca fecha.
**Causa raiz**: o regex `[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}` casa a máscara de CPF (zeros) e o domínio institucional aparece na cópia legal versionada.
**Regra**: ao escrever critério de grep de PII, (1) exigir 1º dígito `[1-9]` no CPF para não casar máscaras `000...`; (2) listar explicitamente as exceções aceitas (`devSeed.ts`, `lib/termo.ts`, `*.test.tsx`, `_test.go`, `testdata`); (3) rodar o grep e conferir que só sobram as exceções antes de fechar o critério.

## 2026-09-19 — Spec 030 — `caarlos0/env` v11: `required` ≠ não-vazio e erro com nome do campo

**Contexto**: migração do leitor manual de config para `github.com/caarlos0/env/v11`.
**Detalhes**: (1) `env:"KEY,required"` só erra se a var **não existe** — vazio passa; para reproduzir o "ausente OU vazio" antigo, usar `env:"KEY,required,notEmpty"`; (2) `envDefault` é usado quando a var está ausente **ou vazia**; (3) erro de conversão usa o **nome do campo** (`Port`), não a tag (`PORT`) — asserções de teste devem usar `Port`/`SessionExpirySeconds`; (4) o erro agregado é `env.AggregateError` (valor, não ponteiro) e junta todas as ausentes.
**Regra**: ao migrar para `caarlos0/env`, lembrar do par `required,notEmpty` e ajustar as mensagens esperadas nos testes para os nomes dos campos.
## 2026-09-20 — Spec 033 — spec marcada `done` sem checkboxes dos critérios de aceite

**Erro**: o commit final `docs(specs): mark 033 as done` alterou `status: done` mas deixou todos os 8 CAs com `[ ]` (não marcados). Uma validação posterior teve que verificar cada critério manualmente para confirmar que o código realmente atendia.

**Causa raiz**: o agente focou em alterar a linha de `status` e não revisou o bloco de critérios de aceite logo abaixo. O diff do commit confirma: 1 inserção, 1 deleção — só o status mudou.

**Regra**: ao marcar uma spec como `done`, SEMPRE percorrer todos os critérios de aceite e marcar `[x]` nos que foram atendidos. Se houver critério não atendido, a spec NÃO pode ir para `done`. A checagem é: `status: done` ⟺ todos os CAs `[x]` + gates verdes.

## 2026-09-20 — Spec 034 — arquivos temporarios no repositorio

**Contexto**: arquivos temporarios fix*.md sendo salvos na raiz do repositorio e entrando como tracking para o git.

**Regra**: prefira sempre salvar arquivos temporarios em uma pasta temporaria do usuario, seja c:\Temp ou c:\TMP no caso de windows ou /tmp para linux, apague o arquivo quando nao for mais necessario

## 2026-09-20 — Spec 034 — Testes integrados: sessão retorna 200, não 201

**Contexto**: o spec plano dizia que `POST /api/session` retorna 201, mas o handler Go retorna `http.StatusOK` (200). Todos os helpers `criarSessao` e testes diretos precisaram ser corrigidos.

**Causa raiz**: o spec 008 original previa 201, mas a implementação Go usou 200 (presenter.NewOK). A spec 034 copiou a expectativa 201 sem verificar o handler real.

**Regra**: ao planejar testes integrados, verificar o status code real dos handlers no código (não copiar de specs antigas). Rotas podem ter sido alteradas durante a implementação sem atualizar o spec original.

## 2026-09-20 — Spec 034 — Template string concatenation com backtick vs aspas

**Contexto**: no helper `criarAceite`, o JSON body usa backtick (`) para string com `+entity.TermoVersaoAtual+`. Inicialmente estava escrito como `""+"entity.TermoVersaoAtual"+""` (aspas + concat dentro de backtick), que em Go resulta na string literal `""+"entity.TermoVersaoAtual"+""` em vez de concatenar a variável.

**Causa raiz**: confusão entre template literals JS e Go — em Go, backtick é raw string literal, não template string. Concatenação deve ser feita fora do backtick com `+`.

**Regra**: em Go, backtick (`) cria raw string literals — não suporta interpolação. Para concatenar variáveis com strings contendo aspas, use `+"var"+` entre raw strings.

## 2026-09-20 — Spec 034 — SQS fila compartilhada entre testes

**Contexto**: `TestIntegrationAlteracao_FluxoFeliz` lê da mesma fila SQS que `TestIntegrationAbertura_*`, recebendo mensagens de testes anteriores. A validação falha porque a mensagem LIDA não é a esperada.

**Causa raiz**: a fila SQS é criada uma vez no `TestMain` e compartilhada por todos os testes. Sempre que um teste publica uma mensagem, o próximo teste pode lê-la se não drenar antes.

**Regra**: antes de publicar e ler SQS em testes de integração com fila compartilhada, drenar todas as mensagens pendentes com `drenarFilaSQS()` para garantir que só a mensagem esperada seja lida.