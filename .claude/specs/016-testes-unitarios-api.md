---
id: "016"
title: "Testes Unitários — apps/api-golang (Meta 100% / Piso 95%)"
status: draft
created: 2026-07-07
author: "Claude"
batch_size: "medium"
depends_on: ["015"]
---

# Testes Unitários — apps/api-golang (Meta 100% / Piso 95%)

## Contexto

A Spec 015 configura o framework de testes unitários (Vitest) e a régua de cobertura (100% de meta, 95% de piso obrigatório por arquivo) para os três workspaces, mas só entrega `packages/shared` totalmente coberto — `apps/api` fica só com scaffolding (`vitest.config.ts` funcional, zero testes). `apps/api` concentra toda a lógica de negócio sensível do sistema: autenticação de sessão, rate limiting, geração de protocolo, derivação de keys S3 (prevenção de path traversal), regras de TTL/retenção LGPD, e os efeitos colaterais reais em DynamoDB/S3/SQS. É o workspace com maior risco se quebrar silenciosamente — e hoje só tem a Spec 014 (E2E, lenta, caminho feliz) como rede de segurança.

## Objetivo

Escrever a suíte de testes unitários para todo `apps/api` (`lib/auth.ts`, `lib/rateLimit.ts`, `lib/aws/dynamodb.ts`, `lib/aws/s3.ts`, `lib/aws/sqs.ts`, e cada `app/api/*/route.ts`), atingindo 100% de cobertura por arquivo (piso 95%, com justificativa registrada para qualquer arquivo que não feche em 100% — mesma régua da Spec 015). Diferente da Spec 014 (E2E contra o Floci real), estes testes mockam os clients AWS SDK — rápidos, isolados, sem dependência de Docker rodando.

## Fora de escopo

- Testes de integração reais contra Floci/AWS (já cobertos pela Spec 014 — E2E).
- Testes do handler `DELETE /api/session` da Spec 011, caso ainda não esteja implementado no momento de iniciar este batch — se a Spec 011 já estiver `done`, seu handler entra no escopo desta spec; se não, fica para um batch de continuação.
- Testes do worker (Spec 013, não implementado).
- Qualquer refactor de lógica de negócio além do mínimo necessário para tornar código testável (ex.: extrair uma função pura de um handler acoplado a `NextRequest`).

## Design

### Estratégia de mock dos clients AWS

Usar `aws-sdk-client-mock` (biblioteca purpose-built para mockar `@aws-sdk/client-*` v3, mantida ativamente, integra bem com Vitest) em vez de mocks manuais por `vi.mock()` — evita reescrever a reconstrução de cada client (`DynamoDBClient`, `S3Client`, `SQSClient`, `S3RequestPresigner`) à mão em cada arquivo de teste. Cada teste configura o mock para devolver a resposta esperada (ou lançar erro, para os casos de falha) e verifica os argumentos com que o SDK foi chamado (ex.: `expect(dynamoMock).toHaveReceivedCommandWith(PutItemCommand, { ... })`).

### Testando Route Handlers sem subir servidor

Next.js 14 Route Handlers são funções exportadas (`GET`, `POST`, `DELETE`) que recebem `NextRequest`. Testadas diretamente, sem HTTP real:

```ts
import { POST } from '../app/api/draft/route';
const req = new NextRequest('http://localhost/api/draft', {
  method: 'POST',
  headers: { cookie: 'prolink_session=...' },
  body: JSON.stringify({ ... }),
});
const res = await POST(req);
expect(res.status).toBe(200);
```

`cookies()` de `next/headers` (usado dentro de `lib/auth.ts`) só funciona dentro do request-scope do Next.js — se os testes tropeçarem nisso, a alternativa é isolar a leitura do cookie da lógica de negócio (ex.: `requireSession(cookieValue: string)` recebendo a string já extraída, chamado pelo handler que lê `cookies()`) — decisão a confirmar durante a implementação, documentar aqui se a assinatura de alguma função de `lib/auth.ts` precisar mudar por causa disso.

### Plano de testes

| Arquivo | Casos a cobrir |
|---|---|
| `lib/auth.ts` | `createOrGetSession` (sessão nova vs. existente); `requireSession` — 403 sem cookie, 403 JWT inválido/expirado, 403 sessão não existe no DynamoDB, 403 `status === 'enviado'`; `requireAceite` — 403 sem `prolink_aceite` válido |
| `lib/rateLimit.ts` | Requisição dentro do limite; no limite exato; excede limite (429); isolamento por IP (dois IPs não compartilham contador); reset de janela de tempo |
| `lib/aws/dynamodb.ts` | Put/get/update/delete de rascunho; cálculo de TTL (`now + 7200s` para rascunho, `now + 30 dias` no submit); zeragem de `payload`/`documentosKeys` no submit |
| `lib/aws/s3.ts` | Geração de presigned URL; validação/rejeição de `campo` fora do regex `/^[a-z0-9_]{1,80}$/` (prevenção de path traversal); copy de `{sessionId}/` para `protocolos/{protocolo}/`; delete do prefixo da sessão |
| `lib/aws/sqs.ts` | Shape da mensagem publicada (`{ sessionId, protocolo, tipo }`) |
| `app/api/session/route.ts` | `POST` happy path (cookie `prolink_session` setado); 403 sem `prolink_aceite` |
| `app/api/draft/route.ts` | `GET` retorna rascunho / `null`; `POST` salva com Zod válido, rejeita payload inválido/campo desconhecido (schema `.strict().partial()`) |
| `app/api/upload-url/route.ts` | Retorna `{ url }` sem expor key/sessionId; 429 ao exceder rate limit |
| `app/api/submit/route.ts` | Happy path completo (protocolo gerado, DynamoDB atualizado, SQS publicado, cookie invalidado); payload Zod inválido → 400 |
| `app/api/aceite-termo/route.ts` | Registra aceite, seta cookie `prolink_aceite` |

### Camadas afetadas

| Camada | Arquivo | Ação |
|--------|---------|------|
| Root | `package.json` | MODIFY — devDependency `aws-sdk-client-mock` |
| Testes | `apps/api/lib/auth.test.ts` | CREATE |
| Testes | `apps/api/lib/rateLimit.test.ts` | CREATE |
| Testes | `apps/api/lib/aws/dynamodb.test.ts` | CREATE |
| Testes | `apps/api/lib/aws/s3.test.ts` | CREATE |
| Testes | `apps/api/lib/aws/sqs.test.ts` | CREATE |
| Testes | `apps/api/app/api/session/route.test.ts` | CREATE |
| Testes | `apps/api/app/api/draft/route.test.ts` | CREATE |
| Testes | `apps/api/app/api/upload-url/route.test.ts` | CREATE |
| Testes | `apps/api/app/api/submit/route.test.ts` | CREATE |
| Testes | `apps/api/app/api/aceite-termo/route.test.ts` | CREATE |

## Critérios de aceite

- [ ] `aws-sdk-client-mock` adicionado; nenhum teste desta spec depende de Docker/Floci rodando (100% mockado)
- [ ] Todos os arquivos de `apps/api/lib/` e `apps/api/app/api/*/route.ts` com testes atingindo 100% de cobertura individual (piso 95% — qualquer arquivo abaixo de 100% tem a lacuna justificada em uma frase, mesma régua da Spec 015)
- [ ] Route handlers testados via chamada direta com `NextRequest` construído manualmente — sem servidor HTTP real subindo
- [ ] Testes cobrem todos os códigos de erro documentados nas Specs 007/008/011 (403 sem aceite, 403 sem sessão válida, 403 sessão `enviado`, 429 rate limit, 400 payload Zod inválido)
- [ ] `npm run test:coverage -w apps/api` passa o gate de 95%
- [ ] `npm run lint` passando

## Notas

- Depende da Spec 015 estar `done` (scaffolding do Vitest em `apps/api/vitest.config.ts` já criado lá).
- Se `lib/auth.ts` precisar de mudança de assinatura para ficar testável (isolar leitura de `cookies()` da lógica pura), essa mudança é parte do escopo desta spec — não é uma mudança de comportamento, só de testabilidade, então não exige nova spec própria.
- O handler `DELETE /api/session` (Spec 011) entra no escopo se a Spec 011 já estiver implementada quando este batch começar; caso contrário, fica pendente para um pequeno batch de continuação depois que a 011 for concluída.
