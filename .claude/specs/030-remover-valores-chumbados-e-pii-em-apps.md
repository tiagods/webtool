---
id: "030"
title: "Remover valores chumbados e PII (apps/ + Compose/deploy) (crítico → baixo)"
status: approved        # draft | review | approved | in-progress | done | rejected
created: 2026-09-08
author: "tiagods"
batch_size: "small"     # small (≤ meio dia)
depends_on: ["029"]     # o mapa foi feito sobre a árvore pós-029 (apps/web + apps/backend)
---

# Remover valores chumbados e PII (`apps/` + Compose/deploy)

## Contexto

Auditoria de valores chumbados em `apps/` (feita sobre a árvore pós-029: só `apps/web` e
`apps/backend`). Objetivo declarado: **nenhuma variável chumbada em `apps/` — e-mail, nome,
telefone, CPF/RG e demais PII, além de segredos e nomes de recurso que deveriam vir de env.**

A remoção de `apps/api-node` (spec 029) já eliminou o maior foco de duplicação (o fallback
`'dev-secret-change-in-production'` repetido em 7 route handlers e os `?? 'prolink-fichas'` /
`?? 'test'` da camada AWS Node). O que sobra está listado abaixo — **todos** os pontos, de
crítico a baixo, serão revisados nesta spec; nenhum fica de fora, mesmo os que a revisão vier a
aceitar sem mudança.

`apps/backend` (Go) — auditoria recente confirma que `infrastructure/config/config.go` é o único
ponto que lê o ambiente (`os.LookupEnv`), com falha rápida agregada (`required(...)`) e sem default
de segredo. Os únicos literais "de negócio" no código Go são `CookieAceite = "prolink_aceite"` /
`CookieSessao = "prolink_session"` em `infrastructure/auth/cookie.go` — nomes de cookie
(protocolo), não config. **Mas o backend não se resume ao código Go**: a PII real do lado servidor
vive nas camadas ao redor — fallback de `SMTP_TO` nos Compose de dev e prod, e-mail pessoal em
comentário de `config.go` e env vars SMTP fora da documentação. Ver inventário do backend (B1–B5)
abaixo; nada fica "sem ação" sem veredito explícito.

## Objetivo

Sem mudança de comportamento observável do fluxo:

1. Zerar a PII embutida no código do frontend.
2. Alinhar o frontend ao backend: **sem fallback de segredo** — falha rápida se `JWT_SECRET`
   estiver ausente.
3. Sanear os `*.env*.example` para refletir o que cada app realmente lê.
4. Revisar e **registrar o veredito** (mudar / aceitar como está) de cada literal institucional
   e de cada fixture de teste sinalizado.
5. Validar o backend fora do `apps/web`: remover os fallbacks de `SMTP_TO`/`SMTP_FROM` (PII) dos
   Compose mantendo **todos** os params SMTP `required`, sanear comentários de `config.go`,
   documentar as env vars SMTP e migrar o leitor manual de config para `github.com/caarlos0/env`
   (preservando o fail-fast agregado).

## Fora de escopo

- Mudança de **comportamento** em `apps/backend/**` fora do escopo de config: o código Go de
  domínio e rotas segue conforme. As ações de backend desta spec são comentário (B3),
  documentação (B4), Compose na raiz (B1/B2) e a migração do leitor de config (B5) — nenhuma
  lógica de negócio é alterada.
- Extrair o texto do termo LGPD para um CMS / banco — o termo é versionado por
  `TERMO_VERSAO_ATUAL` e mora de propósito no código (ver F5).
- Rebranding ou tornar o nome "Prolink Contábil" configurável (ver F6).
- i18n / externalização de strings de UI em geral.
- `packages/shared` — sem PII; fora do recorte "`apps/`".

## Design

### Inventário completo dos pontos

| # | Sev | Local | O que está chumbado | Veredito proposto |
|---|-----|-------|---------------------|-------------------|
| F1 | 🔴 Crítico | `apps/web/app/abertura/StepperEngine.tsx:29–110` | Dossiê completo de 2 "sócios" no `defaultValues`: nomes, **CPF/RG/PIS**, telefones, **e-mails `@prolinkcontabil.com.br`** (domínio real), endereços, filiação, CRC, IPTU, banco, capital, pró-labore | **MUDAR** — zerar defaults (padrão limpo); criar `devSeed.ts` sintético aplicado só em dev |
| F2 | 🟠 Alto | `apps/web/middleware.ts:5-6` | `process.env.JWT_SECRET ?? 'dev-secret-change-in-production'` | **MUDAR** — falha rápida, sem fallback |
| F3 | 🟡 Médio | `apps/web/.env.local.example` | Lista `AWS_ENDPOINT_URL/REGION/ACCESS_KEY_ID/SECRET_ACCESS_KEY/DYNAMODB_TABLE/S3_BUCKET/SQS_QUEUE_URL/SNS_TOPIC_ARN` — `apps/web` **não tem acesso à AWS** (CLAUDE.md). Inclui `AWS_SECRET_ACCESS_KEY=test` | **MUDAR** — enxugar para o que o web lê |
| F4 | 🟡 Médio | `apps/web/next.config.mjs:14` | `destination: 'http://localhost:3001/api/:path*'` | **ACEITAR** — já sob guarda `NODE_ENV !== 'development' → return []`; extrair para constante nomeada |
| F5 | 🟢 Baixo | `apps/web/lib/termo.ts` | Texto do termo LGPD: retenção "5 anos", base legal, título "Prolink Contábil", `TERMO_CONTATO_EMAIL = 'contato@prolinkcontabil.com.br'` | **ACEITAR** — é a cópia legal versionada; e-mail comercial público, não PII |
| F6 | 🟢 Baixo | `apps/web/app/layout.tsx`, `app/page.tsx`, `app/abertura/layout.tsx`, `app/alteracao/layout.tsx` | String "Prolink Contábil" em `<title>` / headings | **ACEITAR** — nome do produto, não config nem PII |
| F7 | 🟢 Baixo | `apps/web/lib/viacep.ts:38` | `https://viacep.com.br/ws/${digits}/json/` | **ACEITAR** — endpoint público de terceiro; extrair para `VIACEP_BASE_URL` (const nomeada) |
| F8 | 🟢 Baixo | `apps/web/lib/masks.ts`, placeholders `000.000.000-00` etc. nos steps | Padrões de máscara / placeholders de input | **ACEITAR** — máscara, não dado |
| F9 | ⚪ Fixture | `apps/backend/domain/validation/testdata/casos_{abertura,alteracao}.json` e vários `*_test.go` | `joao@example.com`, `ana@example.com`, `(11) 98765-4321`, CPF `123.456.789-09`, CNPJ `12345678000190`, `"Prolink Servicos Ltda"` | **ACEITAR** — dado sintético de caracterização gerado por `scripts/gen-*`; `@example.com` é domínio reservado (RFC 2606). Registrar veredito em nota |

### Inventário do backend (Go + Compose)

| # | Sev | Local | O que está chumbado | Veredito proposto |
|---|-----|-------|---------------------|-------------------|
| B1 | 🔴 Crítico | `docker-compose.yml:115` e `docker-compose.prod.yml:64` | `SMTP_TO: ${SMTP_TO:-tiagoice@hotmail.com}` — e-mail pessoal real como fallback silencioso (até em prod) | **MUDAR** — sem fallback; `SMTP_TO` required (sem default) |
| B2 | 🟡 Médio | `docker-compose.yml:114` e `docker-compose.prod.yml:63` | `SMTP_FROM: ${SMTP_FROM:-noreply@prolinkcontabil.com.br}` — fallback institucional | **MUDAR** — sem fallback; `SMTP_FROM` required (sem default); documentar exemplo em `.env.example` |
| B3 | ⚪ Comentário | `apps/backend/infrastructure/config/config.go:56-57` | Comentários de exemplo com `tiagoice@hotmail.com` (e-mail pessoal) e `noreply@prolinkcontabil.com.br` | **MUDAR** — trocar por `destinatario@example.com` / `noreply@example.com` |
| B4 | ⚪ Docs | `docs/aws.md:9` e `deploy.md:22` | Enumeram as env vars obrigatórias mas **omitem o bloco SMTP** (`SMTP_HOST/PORT/USER/PASSWORD/FROM/TO`) | **MUDAR** — listar o bloco SMTP nas duas |
| B5 | 🔵 Refactor | `apps/backend/infrastructure/config/config.go` | Leitor manual de env (`reader`, `required`, `optional`, `intOr`, `secondsOr`, `enum`) | **MUDAR** — migrar para `github.com/caarlos0/env`, preservando fail-fast agregado e o condicional de credenciais AWS |

### F1 — zerar a PII do formulário de abertura

**Problema:** `defaultValues` é aplicado incondicionalmente (não há guarda de ambiente), logo o
formulário em produção abre pré-preenchido com dados pessoais realistas e **dois e-mails no
domínio real da empresa**. Além do vazamento de aparência, polui submissões reais se o usuário
não limpar campos.

**Solução:** substituir o bloco por defaults **vazios**, no mesmo padrão já usado em
`apps/web/app/alteracao/StepperEngine.tsx` (strings `''`, booleanos `false`, arrays com um item
"molde" vazio). Forma esperada:

```ts
defaultValues: {
  dadosEmpresa: {
    tipoConstituicao: 'ltda',
    nomeEmpresarial1: '', nomeEmpresarial2: '', nomeEmpresarial3: '',
    nomeFantasia: '', atividade: '',
  },
  endereco: {
    cep: '', logradouro: '', numero: '', complemento: '',
    bairro: '', municipio: '', estado: '', iptu: '', imovelAlugado: false,
  },
  dadosSocios: {
    socios: [ socioVazio() ],   // helper local: todos os campos '' / false / undefined
  },
  sociedade: {
    capitalSocial: undefined,
    quotas: [{ percentual: undefined, isAdministrador: false }],
    tipoAdministracao: 'isoladamente',
    banco: '',
  },
  senhaGovBr: '',
  documentosAceitos: false,
}
```

- `tipoConstituicao: 'ltda'` e `tipoAdministracao: 'isoladamente'` **permanecem** — são escolha
  padrão de UI (radio pré-selecionado), não PII.
- Campos numéricos (`capitalSocial`, `proLabore`, `percentual`) passam a `undefined` para não
  plantar `0` — validar que os inputs controlados (`CURRENCY_MASK`, `react-hook-form`) aceitam
  `undefined` sem warning de "uncontrolled → controlled". Se aceitarem mal, usar `'' as any`
  como faz o step de alteração, ou `0` com o campo marcado obrigatório no Zod (já é).
- **Seed de desenvolvimento (decidido):** criar `apps/web/app/abertura/devSeed.ts` com **dados
  100% sintéticos** (sem `@prolinkcontabil.com.br`, sem CPF/telefone de pessoa real; usar
  `@example.com` e CPFs de teste com dígito verificador válido). O padrão do formulário é **tudo
  limpo**; o seed é aplicado **somente no ambiente local**:
  `methods.reset(process.env.NODE_ENV === 'development' ? devSeed : undefined)` dentro do
  `useEffect` que já roda no mount, **antes** do fetch do rascunho. Em produção (build real) o
  seed fica fora do bundle (tree-shaken) e o formulário abre vazio.

### F2 — falha rápida de `JWT_SECRET` no middleware

Alinhar ao backend Go (`config.go` → `required("JWT_SECRET")`, sem fallback; o
`.env.example` já afirma "não há fallback no código"):

```ts
const rawSecret = process.env.JWT_SECRET;
if (!rawSecret) {
  throw new Error('JWT_SECRET não definida — obrigatória para validar o cookie de aceite');
}
const JWT_SECRET = new TextEncoder().encode(rawSecret);
```

- O `docker-compose.yml` de dev já injeta `${JWT_SECRET:-dev-secret-change-in-production}`, então
  o ambiente local continua funcionando — o fallback sai **do código**, não do compose.
- `middleware.ts` roda no Edge runtime; o `throw` no carregamento do módulo derruba o build/boot
  da rota — comportamento desejado (fail-fast), consistente com o backend.
- Verificar se há **outro** leitor de `JWT_SECRET` no `apps/web` além do `middleware.ts`
  (`grep -rn JWT_SECRET apps/web`). Hoje só há um; se aparecer outro, extrair um
  `apps/web/lib/jwtSecret.ts` com a checagem única.

### F3 — enxugar `apps/web/.env.local.example`

`apps/web` não fala com a AWS (CLAUDE.md: "No AWS access"). O `.env.local.example` deve conter
só o que o código de `apps/web` lê:

```
# JWT — segredo HS256 compartilhado com o backend (valida o cookie de aceite no middleware).
# Sem fallback no código: ausente = erro no boot.
JWT_SECRET=change-me-use-openssl-rand-base64-32
```

- Remover todo o bloco `AWS_*` e `AWS_SNS_TOPIC_ARN`.
- `NEXT_PUBLIC_BASE_URL` / `SESSION_EXPIRY_SECONDS`: **grep primeiro** (`grep -rn
  "NEXT_PUBLIC_BASE_URL\|SESSION_EXPIRY" apps/web`). Hoje não há uso em código — se confirmar,
  remover também; se algum for lido, manter com comentário.
- Conferir se `apps/web/.env.local.example` está referenciado em `docs/` / `deploy.md` e ajustar
  a lista lá também.

### F4 / F7 — constantes nomeadas

Trocar literais soltos por constante com nome, sem mudar valor nem comportamento:

- `apps/web/next.config.mjs`: `const DEV_API_TARGET = 'http://localhost:3001';` (mantém o guard
  `NODE_ENV !== 'development'`).
- `apps/web/lib/viacep.ts`: `const VIACEP_BASE_URL = 'https://viacep.com.br/ws';` e montar a URL
  a partir dela.

### F5 / F6 — aceitos, registrar veredito

Nenhuma alteração de código. Esta spec é o registro de que foram revisados:

- **F5:** `lib/termo.ts` é a fonte única e versionada (`TERMO_VERSAO_ATUAL`) do texto legal
  LGPD. `TERMO_CONTATO_EMAIL` é o e-mail comercial público de contato (aparece no próprio termo
  exibido ao usuário), não PII de pessoa física. Mantido como constante no arquivo.
- **F6:** "Prolink Contábil" é o nome do produto em `<title>` e cabeçalho. Não é config de
  ambiente nem PII. Mantido inline.

### F9 — fixtures de caracterização, aceitos

`testdata/casos_*.json` e os `*_test.go` de validação usam dados **sintéticos** gerados por
`scripts/gen-{abertura,alteracao}-characterization.mjs` a partir dos schemas Zod. E-mails em
`@example.com` (domínio reservado por RFC 2606 justamente para exemplos), telefone/CPF/CNPJ
fictícios com dígito verificador válido (necessário para os casos "válidos" do validador).
**Sem PII real.** Ação: adicionar uma linha em `apps/backend/domain/validation/testdata/README`
(ou comentário no topo dos `.mjs`) afirmando "dados sintéticos — não usar PII real aqui".

### B1 — `SMTP_TO` sem fallback, required

`docker-compose.yml:115` e `docker-compose.prod.yml:64` trazem
`SMTP_TO: ${SMTP_TO:-tiagoice@hotmail.com}` — e-mail pessoal como default, roteando notificações
internas para um inbox pessoal se a var faltar (inclusive em prod). Solução: remover o default e
manter **required** — `SMTP_TO: ${SMTP_TO:?SMTP_TO é obrigatória}` (o Compose falha se ausente).
Nada fica "vazio/opcional". O valor real mora no `.env` (raiz); `.env.example` documenta a var com
placeholder `destinatario@example.com`.

### B2 — `SMTP_FROM` sem fallback, required

`noreply@prolinkcontabil.com.br` é domínio institucional próprio (não PII), mas o padrão é o mesmo
do B1: **sem default, required** — `SMTP_FROM: ${SMTP_FROM:?SMTP_FROM é obrigatória}` nos dois
Compose. O valor real (`noreply@prolinkcontabil.com.br`) fica no `.env`; `.env.example` documenta a
var como exemplo, nunca como fallback.

### B3 — comentários de `config.go` com e-mail sintético

Trocar `(ex: "tiagoice@hotmail.com")` → `(ex: "destinatario@example.com")` e
`(ex: "noreply@prolinkcontabil.com.br")` → `(ex: "noreply@example.com")`. Exemplo ilustrativo, sem
impacto em runtime.

### B4 — documentar bloco SMTP (todas required)

Adicionar a `docs/aws.md` e `deploy.md` as seis variáveis SMTP (`SMTP_HOST/PORT/USER/PASSWORD/FROM/TO`),
todas **required** — nenhuma com default em código ou Compose.

### B5 — migrar config para `caarlos0/env`

Substituir o leitor manual (`reader{Lookup}` + `required`/`optional`/`intOr`/`secondsOr`/`enum`) por
struct com tags `env`/`envDefault` de `github.com/caarlos0/env`. Preservar:

- **Fail-fast agregado**: a lib retorna `*env.AggregateError` listando todas as vars ausentes/inválidas
  de uma vez — manter esse comportamento (o `config_test.go` de hoje depende dele).
- **Condicional AWS**: credenciais obrigatórias só quando `AWS_ENDPOINT_URL` está definida não é
  expressável por tag — vira validação pós-parse (reaproveitar `AWS.UsesCustomEndpoint()`).
- **Durações**: `SESSION_EXPIRY_SECONDS` e `SHUTDOWN_TIMEOUT_SECONDS` continuam em segundos; mapear
  para `time.Duration` via parser próprio (ou `envDefault:"7200s"` + conversão).
- **Enum `APP_ENV`**: `dev`/`prod` vira parse/validação pós-parse (ou parser customizado), rejeitando
  valores fora.
- **SMTP todo required, sem default**: `loadSMTP` passa a exigir os seis campos
  (`SMTP_HOST/PORT/USER/PASSWORD/FROM/TO`) — remove o default `587` de `SMTP_PORT` e o `optional` de
  `SMTP_PASSWORD` (detecta `UsesAuth()` pela presença de user/password, não como sinal de
  opcionalidade).
- **Testabilidade**: `Load(lookup Lookup)` some; `config_test.go` passa a usar `t.Setenv` e assertar
  o texto do erro agregado.
- **Versão**: pinar `github.com/caarlos0/env/v11` no `go.mod`; sem outras dependências novas.
- Gates: `gofmt -l`, `go vet`, `go build ./...`, `go test ./... -race`.

### Camadas afetadas

| Área | Arquivo | Ação |
|------|---------|------|
| Web / form | `apps/web/app/abertura/StepperEngine.tsx` | EDIT — zerar `defaultValues` (F1) |
| Web / form | `apps/web/app/abertura/devSeed.ts` | CREATE — dados sintéticos, só dev (F1) |
| Web / auth | `apps/web/middleware.ts` | EDIT — fail-fast `JWT_SECRET` (F2) |
| Web / config | `apps/web/.env.local.example` | EDIT — remover bloco AWS (F3) |
| Web / config | `apps/web/next.config.mjs` | EDIT — constante nomeada (F4) |
| Web / lib | `apps/web/lib/viacep.ts` | EDIT — `VIACEP_BASE_URL` (F7) |
| Backend / testdata | `apps/backend/domain/validation/testdata/` (README/comentário) | EDIT — nota "sem PII real" (F9) |
| Infra / Compose | `docker-compose.yml`, `docker-compose.prod.yml` | EDIT — `SMTP_TO` sem fallback (B1); decidir `SMTP_FROM` (B2) |
| Backend / config | `apps/backend/infrastructure/config/config.go` | EDIT — comentário sintético (B3); migrar p/ `caarlos0/env` (B5) |
| Backend / config | `apps/backend/infrastructure/config/config_test.go` | EDIT — `t.Setenv` + erro agregado (B5) |
| Backend / deps | `apps/backend/go.mod`, `apps/backend/go.sum` | EDIT — `caarlos0/env` pinado (B5) |
| Root / env | `.env.example` | EDIT — bloco SMTP completo como exemplo `required` (B1/B2/B4) |
| Docs | `docs/aws.md`, `deploy.md` | EDIT — listar bloco SMTP (B4); alinhar `.env` do web |

## Critérios de aceite

- [ ] F1 — `grep -nE "prolinkcontabil\.com\.br|[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}|Tiago Almeida|Fernanda Costa" apps/web/app` → **zero** resultados
- [ ] F1 — `defaultValues` de `abertura/StepperEngine.tsx` só contém `''`, `false`, `undefined`, arrays-molde e os 2 defaults de UI (`tipoConstituicao`, `tipoAdministracao`)
- [ ] F1 — abrir `/abertura` em **produção** mostra todos os campos vazios; sem warning "uncontrolled to controlled" no console
- [ ] F1 — `devSeed.ts` aplicado só com `NODE_ENV=development` (padrão limpo fora de dev); seed 100% sintético; `NODE_ENV=production npm run build -w apps/web` não inclui o seed no bundle (tree-shaken)
- [ ] F2 — `middleware.ts` sem a string `dev-secret-change-in-production`; subir `apps/web` sem `JWT_SECRET` falha com erro claro; `docker compose up` (dev) segue funcionando
- [ ] F3 — `apps/web/.env.local.example` não contém nenhuma linha `AWS_`; contém `JWT_SECRET`
- [ ] F4 / F7 — literais movidos para constante nomeada; comportamento idêntico (rewrite só em dev; ViaCEP funciona)
- [ ] F9 — nota "dados sintéticos, sem PII real" adicionada em `testdata`
- [ ] B1 — `grep -nE "tiagoice|@hotmail|SMTP_TO:-" docker-compose*.yml` → **zero**; `SMTP_TO` required (sem default)
- [ ] B2 — `grep -nE "SMTP_FROM:-" docker-compose*.yml` → **zero**; `SMTP_FROM` required (sem default); exemplo documentado em `.env.example`
- [ ] B1/B2 — todos os seis params SMTP required no Compose e no `config.go` (sem `SMTP_PORT:-587`, sem `SMTP_PASSWORD` opcional)
- [ ] B3 — `grep -nE "tiagoice|@hotmail|@gmail" apps/backend --include="*.go" | grep -v _test.go` → **zero**; comentários de `config.go` usam domínio `example.com`
- [ ] B4 — `docs/aws.md` e `deploy.md` listam `SMTP_HOST/PORT/USER/PASSWORD/FROM/TO`, todas required
- [ ] B5 — `config.go` usa `caarlos0/env`; leitor manual removido; fail-fast agregado preservado (boot sem `JWT_SECRET` lista todas as ausentes)
- [ ] B5 — `config_test.go` verde com `t.Setenv`; condicional de credenciais AWS ainda coberto; `go.mod`/`go.sum` com `caarlos0/env` pinado e sem outras deps novas
- [ ] `grep -rnE "@(gmail|prolinkcontabil|hotmail|outlook)\.|[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}" apps/ | grep -v testdata | grep -v _test.go` → **zero**
- [ ] `npm run build -w apps/web` e `npm run lint -w apps/web` verdes
- [ ] `gofmt -l`, `go vet`, `go build ./...`, `go test ./... -race`, `golangci-lint run ./...` verdes em `apps/backend`
- [ ] `.claude/tasks/lessons.md` atualizado: "PII/seed de dev nunca em `defaultValues` de produção; segredo sem fallback no código, só no compose; sem e-mail pessoal em fallback de Compose"

## Notas

- **Ordem de execução sugerida:** F1 e F2 primeiro (impacto real), depois F3, depois F4/F7/F9 e o
  bloco backend (B1–B5). F5/F6 não têm task — já resolvidos por este registro.
- **Seed de dev (F1):** decisão tomada — criar `devSeed.ts` sintético aplicado **só no ambiente
  local**; fora dele o formulário é limpo. O seed não pode conter `@prolinkcontabil.com.br` nem
  CPF/telefone de pessoa real.
- **Por que não mover o texto do termo (F5) para env/CMS:** o termo é um artefato jurídico
  versionado; mudá-lo exige bump de `TERMO_VERSAO_ATUAL` e revalidação dos aceites já gravados.
  Ele *deve* estar sob controle de versão junto com o código que o exibe.
- **`apps/backend`:** o código Go centraliza env em `config.go` com erro agregado e sem default de
  segredo; a PII real está **fora do Go** — fallback `SMTP_TO` nos Compose, e-mail pessoal em
  comentário e env SMTP não documentado (B1–B4).
- **B5 (caarlos0/env):** versão decidida — `github.com/caarlos0/env/v11`. O refactor é
  comportamentalmente neutro: mantém fail-fast agregado, o condicional AWS e os defaults
  não-secretos (porta 3001, expiração 7200s) — com a ressalva de que o bloco SMTP passa a ser todo
  `required` (B1/B2).
- **Impacto dev (SMTP required):** com os seis params obrigatórios, `docker compose up` (dev) exige
  as vars SMTP exportadas ou presentes no `.env` local, senão o serviço de e-mail falha no boot.
  Sinalizar isso no `.env.example`.
- Rollback: todas as mudanças são locais e reversíveis por `git revert`; nada toca rede, deploy
  ou schema.
