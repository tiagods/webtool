---
id: "024"
title: "Go — auth (JWT/cookies/rate limit) + rotas de sessão e aceite"
status: done
created: 2026-09-07
author: "tiagods"
batch_size: "medium"
depends_on: ["023"]
---

# Go — auth + rotas de sessão e aceite

## Contexto

Com a camada AWS pronta (spec 023), o próximo passo é a autenticação por cookie e as rotas
que a estabelecem. É o ponto de maior risco da migração: o token `prolink_aceite` assinado em
Go **tem** que ser validado pelo `jwtVerify` (`jose`, HS256) do `apps/web/middleware.ts` com
o mesmo `JWT_SECRET`.

## Objetivo

- `infrastructure/auth/jwt.go` — `TokenSigner`/`TokenVerifier` (`golang-jwt/jwt/v5`, HS256):
  - aceite: claims `{sub, versaoTermo, iat, exp}`, cookie `prolink_aceite`, maxAge 1 ano
  - sessão: claims `{sub, iat, exp}`, cookie `prolink_session`, exp = `SESSION_EXPIRY_SECONDS`
- Helpers de cookie: `httpOnly`, `SameSite=Lax`, `Secure` = `cfg.IsProd()`, `Path=/`.
- `infrastructure/ratelimit/memory.go` — janela fixa 20 req / 60s por IP (`x-forwarded-for`).
- `domain/service`: `AceiteService` (grava `RegistroAceite`, assina aceite),
  `SessionService` (`createOrGetSession` — reusa cookie válido ou cria UUID + `ensureRascunhoInicial`;
  `requireAceite`; `requireSession` parametrizado por tabela).
- `adapter/web`: rotas
  - `POST /api/aceite-termo`
  - `POST /api/session`, `DELETE /api/session` (403 sessão inexistente, **409** se `enviado`)
  - `POST /api/alteracao/session`
- Middleware Echo para o guard (`requireAceite` + `requireSession`).
- Mapper erro-de-domínio → status HTTP (um único `HTTPErrorHandler`).

## Fora de escopo

- `/api/draft`, `/api/submit`, `/api/upload-url` e as rotas de alteração de dados (specs 025+).
- Validação dos payloads de formulário.

## Design

`domain` define sentinelas `ErrAceiteAusente`, `ErrSessaoInvalida`, `ErrSessaoEnviada`. O
`adapter/web` mapeia: `ErrAceiteAusente`→403, `ErrSessaoInvalida`→403, `ErrSessaoEnviada`→409.

Cross-verificação obrigatória: script/teste que assina um `prolink_aceite` em Go e valida com
`jose` (Node) — mesmo segredo, mesmo `alg`, mesmas claims.

## Critérios de aceite

- [x] Token `prolink_aceite` assinado em Go validado por `jose` no `apps/web/middleware.ts` (teste cruzado — `TestJWT_CompatibilidadeComJose` via `scripts/verify-jwt-cross.mjs`)
- [x] Cookies com atributos idênticos ao Node (`httpOnly`, `SameSite=Lax`, `Secure` só em prod, `Path=/`, maxAge) — `infrastructure/auth/cookie.go` + testes de handler
- [x] `DELETE /api/session`: 403 / 409 / limpeza S3+DynamoDB + expira cookie, conforme contrato (`SessaoService.EncerrarPorToken` + `TestDeleteSession`)
- [x] Rate limit não regride — `ratelimit.FixedWindow` (20/60s por IP) + middleware `rateLimit` aplicado a todo `/api`; `memory_test.go` + `TestRateLimit`. Spec 025 ajusta o alcance ao adicionar `/api/upload-url`
- [x] `make lint` (golangci-lint 0 issues) + `make test` (`-race`) + `make test-integration` verdes; `docker compose build api-go` verde

## Notas

- `createOrGetSession` é o único ponto que faz bootstrap do item de rascunho — parametrizar a
  tabela (lição da spec 012: item órfão na tabela de Abertura).
