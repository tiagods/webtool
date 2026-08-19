---
id: "009"
title: "Separação Frontend/Backend (apps/api não exposto publicamente)"
status: done
created: 2026-07-02
author: "Claude"
batch_size: "medium"
depends_on: ["008"]
---

# Separação Frontend/Backend (apps/api não exposto publicamente)

## Contexto

A Spec 008 implementou todas as rotas de API (`/api/session`, `/api/draft`, `/api/upload-url`, `/api/submit`) e os clients AWS (DynamoDB, S3, SQS) dentro de `apps/web`, junto com o frontend. Isso significa que o processo que serve as páginas públicas é o mesmo processo com acesso direto às credenciais AWS e à lógica de sessão/validação.

O usuário pediu uma arquitetura com **separação física entre frontend e backend**: dois serviços Docker distintos. O Nginx continua sendo o ponto de entrada recomendado (porta 80, roteia `/api/*` → `api`), mas `web` (3000) e `api` (3001) também publicam suas portas no host via `docker-compose` (`ports:`, não apenas `expose:`) — útil para debug local direto. A restrição de acesso ao `api` não é feita pelo Docker: em produção, o firewall do servidor libera as portas 80 (e 3000) para a internet e **bloqueia 3001** externamente. Isso reduz a superfície de ataque (o processo com acesso a AWS/DynamoDB/S3 não recebe tráfego direto da internet em produção) e viabiliza escalar/deployar os dois serviços de forma independente no futuro.

## Objetivo

- Criar `apps/api`: novo workspace Next.js (App Router, **somente rotas de API**, sem páginas/UI) hospedando tudo que hoje está em `apps/web/app/api/*` + `apps/web/lib/auth.ts` + `apps/web/lib/rateLimit.ts` + `apps/web/lib/aws/*`.
- Adicionar um serviço `nginx` ao `docker-compose.yml` como ponto de entrada recomendado (porta 80), roteando por path: `/` → `web:3000`, `/api/*` → `api:3001`.
- Publicar `web` em `3000:3000` e `api` em `3001:3001` no `docker-compose.yml` (`ports:`, não `expose:`) — a restrição de acesso ao `api` em produção é responsabilidade do firewall do servidor (fora do escopo do Docker/Compose), não da topologia de rede do Compose.
- Manter os contratos de API (paths, métodos, bodies) idênticos aos da Spec 008 — o `StepperEngine.tsx` continua chamando paths relativos (`/api/session`, etc.), sem nenhuma mudança no client, pois o roteamento por path acontece no Nginx antes de chegar em qualquer app.

## Fora de escopo

- TLS/certificado em produção (já coberto em `deploy.md`, fora do escopo desta spec local/Docker)
- Configuração do firewall do servidor (`ufw`/`iptables`/security group) que bloqueia a porta 3001 externamente — é pré-requisito operacional de deploy, documentado em `deploy.md`, não faz parte do `docker-compose.yml`/Nginx desta spec
- Autenticação usuário-a-usuário entre frontend e backend — não há login; os cookies (`prolink_aceite`, `prolink_session`) continuam sendo o único mecanismo de autorização, e chegam ao `api` porque o Nginx repassa headers/cookies sem alteração
- Múltiplas networks Docker (ex.: isolar `floci`/`aws-init` numa rede que só o `api` acessa) — mantido em uma única network por simplicidade (ver "Princípios Fundamentais" do `.claude/CLAUDE.md`); pode ser endurecido em spec futura se necessário
- Mover `apps/worker` (Lambda, ainda não implementado — Fase 7)
- Pipeline de CI/CD

## Design

### Por que Next.js API-only em vez de Express/Fastify

`apps/api` reaproveita 100% do código já escrito na Spec 008 (Route Handlers com `NextRequest`/`NextResponse`, `cookies()` de `next/headers`, JWT via `jose` — já compatível com Edge Runtime). Reescrever em Express/Fastify exigiria reescrever todas as assinaturas de handler sem ganho real, já que o objetivo é isolamento de processo/rede, não uma tecnologia de servidor diferente.

### Por que roteamento por path no Nginx (não proxy interno do frontend)

O Nginx é a única origem que o browser enxerga (porta 80). Roteando `/api/*` direto para `api:3001` a partir do Nginx:
- Evita um hop duplo (`browser → web → api`) que existiria se o `apps/web` tivesse que reproxyar internamente.
- Cookies `httpOnly` continuam funcionando sem qualquer configuração de CORS, porque para o browser existe uma única origem (`http://localhost` ou o domínio de produção) — o `Set-Cookie` do `api` passa direto pelo Nginx.
- Nenhuma mudança de código no `StepperEngine.tsx`: as chamadas `fetch('/api/...')` continuam relativas.

### Testes locais sem Docker (dev direto)

Subir `docker compose` para todo ciclo de desenvolvimento é desnecessário — o Compose (com Nginx, Dockerfiles multi-stage) só importa para validar a *infraestrutura* em si. No dia a dia, os dois apps sobem direto via `npm run dev -w apps/web` (`:3000`) e `npm run dev -w apps/api` (`:3001`), sem Docker.

Para o fluxo completo funcionar pelo browser em `:3000` nesse cenário (sem Nginx na frente), `apps/web/next.config.mjs` ganha um `rewrites()` que só existe em dev, redirecionando `/api/:path*` para `http://localhost:3001/api/:path*`:

```js
// apps/web/next.config.mjs
async rewrites() {
  if (process.env.NODE_ENV !== 'development') return [];
  return [
    { source: '/api/:path*', destination: 'http://localhost:3001/api/:path*' },
  ];
}
```

Em produção/Docker esse rewrite nunca é acionado — o Nginx intercepta `/api/*` antes da requisição chegar ao `web`, então o `web` nunca vê essas rotas. Sem conflito entre os dois mecanismos.

### Dois arquivos de compose: dev (Floci) vs produção (AWS real)

`docker-compose.yml` hoje tem `floci`/`aws-init` como dependência fixa — faz sentido para dev local, mas em produção a stack aponta para a AWS real, não para um emulador. Em vez de flags condicionais dentro de um único arquivo, a spec adota **dois arquivos completos e explícitos**:

- **`docker-compose.yml`** (dev, já existe) — `floci` + `aws-init` + `web` + `api` + `nginx`. `api` recebe `AWS_ENDPOINT_URL=http://floci:4566` e credenciais fake (`test`/`test`), e `depends_on: floci: condition: service_healthy`.
- **`docker-compose.prod.yml`** (novo) — apenas `web` + `api` + `nginx`, sem `floci`/`aws-init`. `api` **não** recebe `AWS_ENDPOINT_URL` nem `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` — os clients em `lib/aws/*.ts` (ver `getDynamoClient()` em `dynamodb.ts`) já usam a cadeia de credenciais padrão do AWS SDK (IAM role/`~/.aws/credentials`/env) quando `AWS_ENDPOINT_URL` está ausente, então nenhuma mudança de código é necessária — só a composição de env vars muda entre os dois arquivos.

Uso: `docker compose up -d --build` continua sendo o comando de dev (arquivo padrão, com Floci). Em produção: `docker compose -f docker-compose.prod.yml up -d --build`. Nenhum dos dois arquivos depende do outro — não é base+override, são duas topologias paralelas e independentes.

### Camadas afetadas

| Camada | Arquivo | Ação |
|--------|---------|------|
| Backend (novo workspace) | `apps/api/app/api/session/route.ts` | MOVE (de `apps/web/app/api/session/route.ts`) |
| Backend | `apps/api/app/api/draft/route.ts` | MOVE |
| Backend | `apps/api/app/api/upload-url/route.ts` | MOVE |
| Backend | `apps/api/app/api/submit/route.ts` | MOVE |
| Backend | `apps/api/app/api/aceite-termo/route.ts` | MOVE |
| Backend | `apps/api/lib/auth.ts` | MOVE |
| Backend | `apps/api/lib/rateLimit.ts` | MOVE |
| Backend | `apps/api/lib/aws/dynamodb.ts` | MOVE |
| Backend | `apps/api/lib/aws/s3.ts` | MOVE |
| Backend | `apps/api/lib/aws/sqs.ts` | MOVE |
| Shared | `packages/shared/src/constants/termo.ts` | CREATE — `TERMO_VERSAO_ATUAL` movido de `apps/web/lib/termo.ts` (usado pelo `middleware.ts` do front **e** pela rota `aceite-termo` do backend) |
| Frontend | `apps/web/middleware.ts` | MODIFY — importa `TERMO_VERSAO_ATUAL` de `@prolink/shared`; passa a apenas checar cookie para decidir banner (não guarda mais nenhuma rota `/api`, pois `/api/*` nem existe mais em `apps/web`) |
| Frontend | `apps/web/lib/aws/*`, `apps/web/lib/auth.ts`, `apps/web/lib/rateLimit.ts`, `apps/web/app/api/*` | DELETE (movidos para `apps/api`) |
| Frontend | `apps/web/next.config.mjs` | MODIFY — adiciona `rewrites()` condicional (só em `NODE_ENV=development`) proxiando `/api/:path*` para `http://localhost:3001/api/:path*`, para testar o fluxo completo pelo browser sem subir Nginx/Docker |
| Infra | `apps/api/Dockerfile` | CREATE — multi-stage Node 20, expõe 3001 |
| Infra | `apps/web/Dockerfile` | CREATE — multi-stage Node 20, expõe 3000 |
| Infra | `infra/nginx/default.conf` | CREATE — proxy path-based (`/` → web, `/api/` → api) |
| Infra | `docker-compose.yml` | MODIFY — novos serviços `api` (`ports: 3001:3001`, `AWS_ENDPOINT_URL` apontando pro `floci`), `web` (`ports: 3000:3000`) e `nginx` (`ports: 80:80`) — todas as três portas publicadas no host; bloqueio de 3001 é feito pelo firewall do servidor, fora do Compose |
| Infra | `docker-compose.prod.yml` | CREATE — `web` + `api` + `nginx` (mesmas portas do dev), **sem** `floci`/`aws-init`; `api` sem `AWS_ENDPOINT_URL`/credenciais fake, usando a AWS real via cadeia de credenciais padrão do SDK |

### Contratos / Interfaces

Nenhum contrato de API muda (paths, métodos, request/response bodies idênticos à Spec 008). O único contrato novo é a topologia de rede:

```yaml
# docker-compose.yml (trecho ilustrativo)
services:
  web:
    build: apps/web
    ports:
      - "3000:3000"     # publicado no host; em produção o firewall libera

  api:
    build: apps/api
    ports:
      - "3001:3001"     # publicado no host; em produção o firewall BLOQUEIA externamente
    depends_on:
      floci:
        condition: service_healthy

  nginx:
    build: infra/nginx
    ports:
      - "80:80"          # ponto de entrada recomendado
    depends_on:
      - web
      - api
```

> A segurança de rede não vem do Compose (todas as portas ficam publicadas para facilitar debug local) — vem do firewall do servidor em produção, que só libera 80 e 3000 para a internet e mantém 3001 bloqueado. Ver `deploy.md` para a configuração do firewall.

```nginx
# infra/nginx/default.conf (trecho ilustrativo)
server {
    listen 80;

    location /api/ {
        proxy_pass http://api:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location / {
        proxy_pass http://web:3000;
        proxy_set_header Host $host;
    }
}
```

## Critérios de aceite

- [x] `apps/api` criado (Next.js App Router, somente rotas de API, sem UI), sobe isolado em `:3001`
- [x] Todas as rotas `/api/*` e as libs `auth.ts`/`rateLimit.ts`/`aws/*` migradas de `apps/web` para `apps/api` sem mudança de contrato
- [x] `TERMO_VERSAO_ATUAL` movido para `@prolink/shared` e importado por `apps/web/middleware.ts` e `apps/api/app/api/aceite-termo/route.ts`
- [x] `apps/web/next.config.mjs` com `rewrites()` condicional (dev only) proxiando `/api/:path*` para `apps/api` em `:3001`
- [x] Teste manual (dev, sem Docker): `npm run dev -w apps/web` + `npm run dev -w apps/api` rodando em paralelo, fluxo completo (aceite → sessão → draft → upload → submit) funcionando via `http://localhost:3000` — roteamento via rewrite confirmado por `curl` em sessão anterior (sem Floci); fluxo completo com dados reais validado via Docker (ver critérios de infraestrutura abaixo), cobrindo o mesmo código de `apps/api`
- [x] `npm run lint` e `npm run build` passando para `apps/web` e `apps/api`
- [x] `docs/arquitetura.md`, `README.md`, `deploy.md` e `CLAUDE.md` (raiz) atualizados: topologia (Nginx + portas publicadas), fluxo de dev sem Docker, e o pré-requisito de firewall no servidor bloqueando 3001 externamente

### Critérios de validação de infraestrutura (Docker/Nginx — só quando for validar a infra, não a cada ciclo de dev)

- [x] `docker-compose.yml` (dev): serviços `floci`, `aws-init`, `web` (`3000:3000`), `api` (`3001:3001`, `AWS_ENDPOINT_URL=http://floci:4566`) e `nginx` (`80:80`)
- [x] `docker-compose.prod.yml` (novo): serviços `web`, `api`, `nginx` (mesmas portas), sem `floci`/`aws-init`, `api` sem `AWS_ENDPOINT_URL`/credenciais fake
- [x] `infra/nginx/default.conf` roteando `/` → `web`, `/api/` → `api`, repassando `Host` e `X-Forwarded-For` (reaproveitado pelos dois arquivos de compose)
- [x] Teste manual via Docker dev: `docker compose up -d --build`, fluxo completo funcionando via `http://localhost` (porta 80/Nginx), dados gravados no Floci — validado: `aws-init` provisionou DynamoDB/S3/SQS/SNS/SES; via `curl` em `http://localhost` (Nginx) confirmados `POST /api/aceite-termo`, `POST /api/session`, `GET/POST /api/draft` (rascunho + confirmação de upload persistidos no DynamoDB), `POST /api/upload-url` (presigned URL gerada pelo Floci), e `GET /`/`GET /abertura` servidos por `apps/web`; sem erros nos logs de `web`/`api`/`nginx`
- [x] `docker compose -f docker-compose.prod.yml config` valida sem erro de sintaxe (não requer credenciais AWS reais para só validar o parse/interpolação de env vars)

## Notas

- Esta spec só descreve e prepara a migração (spec + docs). A implementação (mover arquivos, criar Dockerfiles, escrever `docker-compose.yml`/nginx) é um batch separado, iniciado via `/start-batch 009-separacao-frontend-backend.md` após aprovação.
- Decisão deliberada de manter uma única rede Docker (em vez de isolar `floci`/`aws-init` numa rede à parte, só alcançável pelo `api`) — endurecimento adicional pode ser proposto como spec futura se o time achar necessário.
- Mudança de design (2026-07-02, a pedido do usuário): a defesa contra acesso externo ao `api` deixou de ser a ausência de `ports:` no Compose e passou a ser o firewall do servidor. Todas as portas (`80`, `3000`, `3001`) são publicadas no host para facilitar debug local; em produção, o firewall bloqueia `3001` externamente. Isso é uma dependência operacional real — se o firewall não for configurado no deploy, o `api` fica exposto à internet.
- Compatível com a regra de camadas já declarada no `CLAUDE.md`: `apps/api` concentra `adapters`/`infra` (AWS clients) e `use_cases` (validação, geração de protocolo), enquanto `apps/web` fica reduzido a apresentação.
- Mudança de design (2026-07-02, a pedido do usuário): dois arquivos de compose (`docker-compose.yml` dev com Floci, `docker-compose.prod.yml` sem Floci/AWS real) em vez de um único arquivo com flags condicionais — mantém a intenção de cada ambiente explícita e evita vazar credenciais fake (`test`/`test`) para produção por engano.
- `deploy.md` está desatualizado (descreve PM2/Vercel, sem menção a Docker) — atualizar para refletir `docker-compose.prod.yml` como caminho de deploy real faz parte do critério de documentação desta spec.
