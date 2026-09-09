---
id: "018"
title: "Centralizar configuração em config.ts e externalizar valores chumbados"
status: rejected       # draft | review | approved | in-progress | done | rejected
created: 2026-07-13
author: "tiagods"
batch_size: "small"    # small (≤ meio dia) | medium (≤1 dia)
depends_on: []         # IDs de specs que precisam estar done
---

> **REJEITADA (superseded) — 2026-09-08.** O alvo desta spec era o `apps/api` Next.js, aposentado
> no cutover para Go (specs 022–028). O binário Go já nasce com configuração centralizada e validada
> em `apps/api/infrastructure/config` (único ponto que lê o ambiente, boot falha rápido com erro
> agregado, zero valor chumbado — `.claude/rules/boas-praticas-go.md` §7/§9). Nada a portar.

# Centralizar configuração em config.ts e externalizar valores chumbados

## Contexto

Vários valores de configuração ainda estão **chumbados** (hardcoded) no código do `apps/api`
— nomes de recursos AWS aparecem como fallback literal espalhados por vários arquivos, e
parâmetros operacionais (TTLs, rate limit, expiração de URL presigned, e-mail de contato)
são constantes de módulo sem possibilidade de override por ambiente.

Além disso, o acesso a `process.env` está **espalhado** por dezenas de pontos (`lib/aws/*`,
`lib/auth.ts`, routes, `middleware.ts`). O mesmo default (ex.: `us-east-1`,
`dev-secret-change-in-production`) é repetido em vários arquivos — se um valor precisar mudar,
há N pontos de edição e risco de divergência.

Isso gera três problemas:
1. **Deploy/ops**: mudar o nome de um bucket, tabela ou ajustar um TTL exige alterar código
   e rebuild, em vez de trocar uma env var no ambiente.
2. **Manutenção**: não há um ponto único de mudança — o mesmo `process.env.X ?? default`
   é duplicado em vários arquivos.
3. **Descoberta**: não existe uma fonte única que liste todas as variáveis suportadas e seus
   defaults. O `README.md` **não documenta nenhuma env var** hoje, e o
   `AWS_DYNAMODB_ACEITES_TABLE` (já lido do ambiente no código) sequer aparece nos
   `.env.local.example`.

## Objetivo

- Criar um **módulo `config.ts` por app** (`apps/api/lib/config.ts` e `apps/web/lib/config.ts`)
  como **único ponto** que lê `process.env` e aplica os defaults. Todo o restante do código
  importa valores já resolvidos desse módulo — **nenhum outro arquivo acessa `process.env`
  de config diretamente**.
- Garantir que **toda** configuração que pode variar por ambiente tenha um **default seguro**
  (mesmo comportamento atual quando a var não estiver definida).
- Atualizar os dois `.env.local.example` (`apps/api` e `apps/web`) com **todas** as
  variáveis e defaults.
- Adicionar ao `README.md` uma seção única e completa (tabela) com **nome, escopo (web/api),
  default e descrição** de cada variável de ambiente.

## Fora de escopo

- Não trocar a implementação do rate limiter (continua em memória) — apenas parametrizar
  janela e limite.
- Não introduzir biblioteca de config/validação de env (ex.: `zod-env`, `envalid`) — manter
  `config.ts` como objeto simples com `process.env.X ?? default`.
- Não mexer em segredos/rotação (`JWT_SECRET` permanece como está — apenas centralizado).
- Não alterar `apps/worker` (ainda planejado, sem código).
- Não criar um pacote de config compartilhado em `packages/shared` — cada app resolve seu
  próprio `process.env` em runtime (builds/processos separados). Ver Notas.

## Design

### Inventário — o que já é env var (manter e documentar)

| Variável | Arquivo | Default atual |
|----------|---------|---------------|
| `AWS_REGION` | `lib/aws/*` | `us-east-1` |
| `AWS_ENDPOINT_URL` | `lib/aws/*` | *(vazio → usa AWS real)* |
| `AWS_ACCESS_KEY_ID` | `lib/aws/*` | `test` |
| `AWS_SECRET_ACCESS_KEY` | `lib/aws/*` | `test` |
| `AWS_DYNAMODB_TABLE` | `lib/aws/dynamodb.ts:42` | `fichas-abertura` |
| `AWS_DYNAMODB_ACEITES_TABLE` | `lib/aws/dynamodb.ts:47` | `prolink-aceites-lgpd` |
| `AWS_S3_BUCKET` | `lib/aws/s3.ts` | `prolink-fichas` |
| `AWS_SQS_QUEUE_URL` | `lib/aws/sqs.ts:27` | `''` |
| `JWT_SECRET` | `lib/auth.ts` + routes + `web/middleware.ts` | `dev-secret-change-in-production` |
| `SESSION_EXPIRY_SECONDS` | `lib/auth.ts:13` | `7200` |

### Inventário — o que ainda está chumbado (converter para env var com default)

| Nova variável | Arquivo / constante atual | Default proposto |
|---------------|---------------------------|------------------|
| `DRAFT_TTL_SECONDS` | `dynamodb.ts` `DUAS_HORAS_EM_SEGUNDOS` | `7200` |
| `SUBMITTED_TTL_SECONDS` | `dynamodb.ts` `TRINTA_DIAS_EM_SEGUNDOS` | `2592000` |
| `ACEITE_TTL_SECONDS` | `dynamodb.ts` `CINCO_ANOS_EM_SEGUNDOS` | `157680000` |
| `RATE_LIMIT_WINDOW_MS` | `rateLimit.ts` `WINDOW_MS` | `60000` |
| `RATE_LIMIT_MAX_REQUESTS` | `rateLimit.ts` `MAX_REQUESTS_PER_WINDOW` | `20` |
| `UPLOAD_URL_EXPIRY_SECONDS` | `s3.ts` `getPresignedUploadUrl` `expiresIn=300` | `300` |
| `SESSION_COOKIE_NAME` | `auth.ts` `SESSION_COOKIE = 'prolink_session'` | `prolink_session` |
| `TERMO_CONTATO_EMAIL` | `web/lib/termo.ts:23` | `contato@prolinkcontabil.com.br` |

> `ALLOWED_CONTENT_TYPES` (`s3.ts`) permanece **chumbado**, porém **movido para `config.ts`**
> como constante centralizada (decisão aprovada — não vira env var).
> `TERMO_CONTATO_EMAIL` usa `NEXT_PUBLIC_` se `termo.ts` for renderizado no browser (ver Notas).

### Módulo `config.ts` (ponto único)

Cada app expõe um objeto `config` congelado, lido **uma vez** de `process.env`. Numéricos
usam `parseInt(... ?? 'default', 10)` (padrão já em `auth.ts:13`). Exemplo `apps/api/lib/config.ts`:

```ts
export const config = {
  aws: {
    region:         process.env.AWS_REGION ?? 'us-east-1',
    endpointUrl:    process.env.AWS_ENDPOINT_URL,
    accessKeyId:    process.env.AWS_ACCESS_KEY_ID ?? 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'test',
    dynamoTable:        process.env.AWS_DYNAMODB_TABLE ?? 'fichas-abertura',
    dynamoAceitesTable: process.env.AWS_DYNAMODB_ACEITES_TABLE ?? 'prolink-aceites-lgpd',
    s3Bucket:       process.env.AWS_S3_BUCKET ?? 'prolink-fichas',
    sqsQueueUrl:    process.env.AWS_SQS_QUEUE_URL ?? '',
  },
  session: {
    jwtSecret:      process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
    expirySeconds:  parseInt(process.env.SESSION_EXPIRY_SECONDS ?? '7200', 10),
    cookieName:     process.env.SESSION_COOKIE_NAME ?? 'prolink_session',
  },
  ttl: {
    draftSeconds:     parseInt(process.env.DRAFT_TTL_SECONDS ?? '7200', 10),
    submittedSeconds: parseInt(process.env.SUBMITTED_TTL_SECONDS ?? '2592000', 10),
    aceiteSeconds:    parseInt(process.env.ACEITE_TTL_SECONDS ?? '157680000', 10),
  },
  rateLimit: {
    windowMs:     parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
    maxRequests:  parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '20', 10),
  },
  upload: {
    urlExpirySeconds: parseInt(process.env.UPLOAD_URL_EXPIRY_SECONDS ?? '300', 10),
    allowedContentTypes: ['application/pdf', 'image/jpeg', 'image/png'] as const, // fixo
  },
} as const;
```

`apps/web/lib/config.ts` cobre o que o web usa: `session.jwtSecret` (middleware),
`baseUrl` (`NEXT_PUBLIC_BASE_URL`) e `termoContatoEmail`. Ver nuance de `NEXT_PUBLIC_` nas Notas.

**Regra**: após esta spec, `process.env.<config>` só pode aparecer **dentro de `config.ts`**.
Exceções que ficam fora do config por serem específicas do runtime: `process.env.NODE_ENV`
(cookie `secure`) e o rewrite dev em `next.config.mjs`.

### Camadas afetadas

| Camada | Arquivo | Ação |
|--------|---------|------|
| Config | `apps/api/lib/config.ts` | **CREATE** (ponto único) |
| Config | `apps/web/lib/config.ts` | **CREATE** (ponto único) |
| API | `apps/api/lib/aws/dynamodb.ts` | EDIT (importa de config: tabelas, TTLs) |
| API | `apps/api/lib/aws/s3.ts` | EDIT (bucket, expiry, content types) |
| API | `apps/api/lib/aws/sqs.ts` | EDIT (region/endpoint/queue de config) |
| API | `apps/api/lib/rateLimit.ts` | EDIT (janela/limite de config) |
| API | `apps/api/lib/auth.ts` | EDIT (jwt/expiry/cookie de config) |
| API | `apps/api/app/api/**/route.ts` | EDIT (JWT_SECRET → config) |
| Web | `apps/web/middleware.ts` | EDIT (JWT_SECRET → config) |
| Web | `apps/web/lib/termo.ts` | EDIT (e-mail contato de config) |
| Config | `apps/api/.env.local.example` | EDIT (add faltantes) |
| Config | `apps/web/.env.local.example` | EDIT (add faltantes) |
| Docs | `README.md` | EDIT (nova seção de env vars) |

## Critérios de aceite

- [ ] `apps/api/lib/config.ts` e `apps/web/lib/config.ts` criados como ponto único de leitura de `process.env` (com defaults)
- [ ] Nenhum arquivo fora de `config.ts` acessa `process.env` de configuração (exceto `NODE_ENV` e `next.config.mjs`) — verificável por grep
- [ ] Todas as constantes do inventário são resolvidas via `config.ts` com default idêntico ao valor atual
- [ ] `apps/api/.env.local.example` e `apps/web/.env.local.example` listam todas as variáveis do respectivo escopo com seus defaults
- [ ] `README.md` tem uma seção "Variáveis de Ambiente" com tabela (nome, escopo, default, descrição)
- [ ] `README.md` e ambos os `.env.local.example` marcam `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` e `AWS_ENDPOINT_URL` como **exclusivas de dev local (Floci)** — em produção não são definidas (a IAM Task Role do Fargate fornece as credenciais; ver Spec 021)
- [ ] Sem mudança de comportamento quando nenhuma env var nova é definida (defaults preservam o atual)
- [ ] Lint passando (`npm run lint`)
- [ ] Build passando (`npm run build`)

## Notas

- **Compatibilidade**: por serem apenas fallbacks com o mesmo valor, a mudança é
  retrocompatível — nenhum ambiente existente quebra.
- **Credenciais AWS estáticas (`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`) são dev-only**:
  o `config.aws` continua lendo-as com default `test` (só têm efeito quando `AWS_ENDPOINT_URL`
  está setado — ver Spec 019), mas em produção **não devem existir**. A Spec 021 entrega as
  IAM Roles do Fargate que as substituem. Esta spec só precisa garantir que os `.env.example`
  e o README deixem isso explícito para ninguém copiar credenciais para produção.
- **`ALLOWED_CONTENT_TYPES`** (decisão aprovada): **manter chumbado** — lista fixa
  (`pdf`/`jpg`/`png`) no código; baixo valor em externalizar e evita erro de parsing.
- **`AWS_SNS_TOPIC_ARN`** (decisão aprovada): **manter** nos `.env.example` e documentar
  como *reservado para a Fase 7 (worker/SES)* — ainda não consumido pelo código atual.
- **`TERMO_CONTATO_EMAIL`** (decisão aprovada): durante o batch, verificar se `termo.ts` roda
  em client component. Se sim, usar `NEXT_PUBLIC_TERMO_CONTATO_EMAIL` (obrigatório para
  expor ao browser); se só for usado server-side, `TERMO_CONTATO_EMAIL` basta.
- **Um `config.ts` por app (não em `packages/shared`)**: env vars são resolvidas em runtime
  no processo de cada app; um módulo compartilhado leria `process.env` no contexto errado e
  não simplifica os builds separados. Se surgir duplicação real de defaults entre web e api,
  reavaliar em spec futura.
- **Nuance `NEXT_PUBLIC_` no `apps/web/lib/config.ts`**: só valores `NEXT_PUBLIC_*` são
  inlined no bundle do browser. Se o `config.ts` do web for importado por client components
  (ex.: via `termo.ts`), campos server-only como `jwtSecret` ficarão `undefined` no client —
  aceitável, mas para evitar confusão, manter `jwtSecret` usado apenas em `middleware.ts`
  (edge/server). Avaliar separar um `config.public.ts` se a mistura incomodar.
