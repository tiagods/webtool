---
id: "008"
title: "Backend e APIs (Fase 6)"
status: done
created: 2026-07-01
author: "Claude"
batch_size: "large"
depends_on: ["004", "005", "006", "007"]
---

# Backend e APIs (Fase 6)

## Contexto

As fases anteriores entregaram o formulário completo com validação (003), integrações externas (004) e upload de documentos (005). A Spec 007 define o Termo de Ciência LGPD, que é pré-requisito: nenhuma rota de dados deve ser acessível sem aceite registrado. Esta spec implementa a camada de persistência e comunicação com a AWS: sessão JWT via cookie httpOnly, rascunho salvo no DynamoDB a cada step, upload direto para S3 via presigned URL, e envio final que publica no SQS.

## Objetivo

Implementar todas as rotas de API do Next.js e os clients AWS necessários para que o formulário de abertura funcione de ponta a ponta localmente:

- `/api/session` — cria sessão JWT httpOnly
- `/api/draft` — GET restaura / POST salva rascunho no DynamoDB
- `/api/upload-url` — gera presigned PUT URL para S3
- `/api/submit` — valida, gera protocolo, copia docs S3, publica SQS
- Página de confirmação `/abertura/confirmacao`

## Fora de escopo

- Worker Lambda (geração de PDF e envio de e-mail via SES) — spec futura, ainda sem número (Fase 7)
- Registro e armazenamento do aceite LGPD (`RegistroAceite`, tabela `prolink-aceites-lgpd`) — já implementado na Spec 007 (`done`); esta spec apenas **consome** o cookie `prolink_aceite` via `requireAceite`
- Autenticação de usuário com login/senha (sessão serve apenas para recuperar rascunho)
- Deploy em produção (Lightsail)
- Testes automatizados end-to-end

## Design

### Autenticação e cookies

O sistema usa **dois cookies httpOnly independentes**:

| Cookie | Propósito | TTL | Gerado em |
|--------|-----------|-----|-----------|
| `prolink_aceite` | Prova de aceite do Termo de Ciência (Spec 007) | 1 ano | `POST /api/aceite-termo` |
| `prolink_session` | Identifica o rascunho em andamento | **2 horas** | `POST /api/session` |

**Regra de guarda em todas as rotas de dados:**

```ts
// Middleware / helper a ser chamado em TODAS as rotas abaixo:
// GET /api/draft, POST /api/draft, POST /api/upload-url, POST /api/submit

async function requireAceite(cookieStore): Promise<boolean> {
  const token = cookieStore.get('prolink_aceite')?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload.versaoTermo === TERMO_VERSAO_ATUAL; // "v1.0"
  } catch { return false; }
}

// Se retornar false → 403 { error: 'Termo de ciência não aceito' }
```

Sem o cookie `prolink_aceite` válido, as rotas retornam **403** — o frontend redireciona para o modal do Termo de Ciência (Spec 007).

### Sessão JWT (`prolink_session`)

Usar `jose` (já instalado) — compatível com Edge Runtime do Next.js.

```ts
// Criar sessão: gera UUID v4 como sessionId, assina JWT HS256, seta cookie httpOnly
// Ler sessão: lê cookie, verifica JWT, retorna sessionId
// TTL: 2h (SESSION_EXPIRY_SECONDS=7200)
```

Cookie: `prolink_session`, httpOnly, sameSite: lax, secure em produção.

> **Motivo do TTL de 2h:** rascunhos contêm dados pessoais sensíveis. Sessões longas aumentam a janela de exposição em caso de vazamento de cookie. 2h é suficiente para completar o formulário em uma sessão contínua; se expirar, o usuário reinicia (dados sensíveis não ficam em memória desnecessariamente).

### DynamoDB — TTL por tipo de registro (tabela `fichas-abertura`)

Todos os itens com dados sensíveis têm TTL explícito. O atributo `ttl` é um Unix timestamp (segundos) — o DynamoDB deleta o item em até 48h após esse instante (deleção eventual, aceitável para conformidade LGPD).

| Tipo de item | `status` | TTL | Motivo |
|---|---|---|---|
| Rascunho | `rascunho` | **2h** após `createdAt` utc | Sessão expira; dado temporário |
| Submetido | `enviado` | **30 dias** após `updatedAt` utc | Backup real está no S3; DynamoDB é só referência |
| COUNTER | — | **Sem TTL** | Sequencial acumulativo — não pode expirar |

> O aceite LGPD tem seu próprio TTL (5 anos) na tabela separada `prolink-aceites-lgpd` — já implementado na Spec 007, fora do escopo desta tabela.

> **Nota sobre o TTL do DynamoDB:** a deleção pode ocorrer em até 48h após o timestamp expirar. Para dados sensíveis isso é aceitável — LGPD não exige precisão de segundos. Itens expirados deixam de ser retornados em leituras mesmo antes da deleção física.

### DynamoDB — estrutura do item (rascunho)

```json
{
  "sessionId": "uuid-v4",
  "tipo": "ltda | slu",
  "status": "rascunho",
  "createdAt": "ISO 8601",
  "updatedAt": "ISO 8601",
  "ttl": "<now + 7200s>",
  "documentosKeys": {
    "socio_0_rg_frente": "{sessionId}/documentos/socio_0_rg_frente.pdf",
    "imovel_iptu":        "{sessionId}/documentos/imovel_iptu.pdf"
  },
  "payload": { ...AberturaFormValues }
}
```

> `documentosKeys` é atualizado server-side a cada upload confirmado. O cliente nunca envia keys S3 — apenas o nome do `campo`.

### DynamoDB — estrutura do item (submetido)

Após o submit, o item é atualizado — `payload` e `documentosKeys` são **zerados** imediatamente, pois o backup definitivo já está no S3 (`protocolos/{protocolo}/`). O TTL é redefinido para 30 dias:

```json
{
  "sessionId": "uuid-v4",
  "tipo": "ltda | slu",
  "status": "enviado",
  "protocolo": "PRO-2026-000001",
  "createdAt": "ISO 8601",
  "updatedAt": "ISO 8601",
  "ttl": "<updatedAt + 30 dias>",
  "documentosKeys": null,
  "payload": null
}
```

> O `payload` e `documentosKeys` são removidos no mesmo `UpdateItem` que muda o status para `'enviado'` — não há janela onde dados sensíveis coexistem com o status submetido.
>
> O Lambda worker também deve zerar esses campos caso o item ainda os contenha ao consumir a mensagem SQS (camada de defesa adicional).

### DynamoDB — item de aceite LGPD (referência — já implementado na Spec 007)

O `RegistroAceite` **não** vive na tabela `fichas-abertura` usada por esta spec. A Spec 007 (`done`) já implementou uma tabela separada `prolink-aceites-lgpd` (PK `sessionId`, SK `versaoTermo`, TTL de 5 anos) justamente para não colidir com o item de rascunho abaixo, que usa `sessionId` como única PK na tabela `fichas-abertura`. Ver `apps/web/lib/aws/dynamodb.ts` (`putRegistroAceite`) e `infra/local/init.sh`.

**Importante — os dois `sessionId` não são o mesmo valor:** `POST /api/aceite-termo` (Spec 007) gera um `sessionId` próprio (UUID) para o `RegistroAceite`, embutido no JWT do cookie `prolink_aceite`. Já `POST /api/session` (esta spec) gera um `sessionId` **independente** para o rascunho, embutido no JWT do cookie `prolink_session`. `requireAceite` só valida que o JWT é íntegro e que `versaoTermo` bate — não correlaciona os dois `sessionId`. Isso é suficiente como *gate* de acesso, mas significa que o registro de auditoria do aceite não referencia diretamente qual rascunho/protocolo foi coberto por ele. Mantido assim por simplicidade (não altera código já `done` da Spec 007); se a correlação virar requisito de auditoria, tratar em spec futura.

### Geração de protocolo

```
PRO-{ANO}-{sequencial 6 dígitos com padding}
Exemplo: PRO-2026-000001
```

Sequencial: usar `UpdateItem` com `ADD` no DynamoDB em um item de controle (`sessionId: "COUNTER"`).

### S3 — presigned URL

```ts
// POST /api/upload-url
// Requer: cookie prolink_aceite válido + prolink_session válido
// Body: { campo: string, contentType: string }
// campo validado com /^[a-z0-9_]{1,80}$/ (já implementado)
// Retorna: { url: string }  ← key NÃO retornada ao cliente
// Validade: 5 minutos
// Key gerada: {sessionId}/documentos/{campo}.{ext}
//
// Após PUT bem-sucedido, cliente chama POST /api/draft com { uploadedCampo: campo }
// O servidor deriva a key e a persiste em documentosKeys no DynamoDB
```

### S3 — ciclo de vida dos objetos

```json
{
  "Rules": [{
    "ID": "delete-rascunhos-abandonados",
    "Filter": { "Prefix": "" },
    "Status": "Enabled",
    "Expiration": { "Days": 30 }
  }]
}
```

- Objetos de sessões abandonadas (nunca submetidas) são removidos em **30 dias** (LGPD Art. 16 — dados não utilizados devem ser eliminados)
- No **submit**: objetos copiados de `{sessionId}/documentos/` para `protocolos/{protocolo}/` e o prefixo da sessão é deletado imediatamente

### S3 — rate limiting em `/api/upload-url`

```ts
// Implementar via Map em memória (suficiente para MVP — Next.js single instance)
// Limite: 20 requests por IP por minuto
// Resposta ao exceder: 429 { error: 'Muitas requisições. Tente novamente em instantes.' }
//
// Para produção multi-instância: substituir por DynamoDB counter ou Redis
```

### Invalidação server-side da sessão no submit

JWT é stateless — `maxAge: 0` no cookie só limpa o browser do usuário que submeteu. Um token capturado (log, proxy, tab duplicado) permanece criptograficamente válido até o `exp`. Para fechar essa janela, o status da sessão é verificado no DynamoDB a cada request:

```ts
// lib/auth.ts — requireSession()
const item = await dynamo.get({ Key: { sessionId } });
if (!item || item.status === 'enviado') {
  return 403; // sessão consumida ou inexistente
}
```

```ts
// POST /api/submit — após publicar no SQS:
await dynamo.update({
  Key: { sessionId },
  UpdateExpression: 'SET #s = :enviado',
  ExpressionAttributeNames:  { '#s': 'status' },
  ExpressionAttributeValues: { ':enviado': 'enviado' },
});
// Depois: maxAge: 0 no cookie prolink_session
```

Custo: 1 leitura extra no DynamoDB por request (desprezível). Garante que sessões submetidas não possam ser reutilizadas mesmo com o JWT ainda dentro do TTL.

### SQS — mensagem de submit

```json
{ "sessionId": "uuid", "protocolo": "PRO-2026-000001", "tipo": "ltda" }
```

> O worker Lambda consome essa mensagem, gera o PDF e publica no **SNS** (`prolink-abertura-emails`). O SES é uma subscription do SNS — a Lambda não chama o SES diretamente.

### Camadas afetadas

| Camada | Arquivo | Ação |
|--------|---------|------|
| AWS client | `apps/web/lib/aws/dynamodb.ts` | JÁ EXISTE (`putRegistroAceite`, Spec 007) — adicionar `putRascunho`, `getRascunho`, `marcarEnviado`, `proximoProtocolo` |
| AWS client | `apps/web/lib/aws/s3.ts` | JÁ EXISTE — completar com copy/delete |
| AWS client | `apps/web/lib/aws/sqs.ts` | CREATE |
| Helper | `apps/web/lib/auth.ts` | CREATE — `requireAceite`, `createOrGetSession`, `requireSession` |
| Helper | `apps/web/lib/rateLimit.ts` | CREATE — rate limiter por IP |
| API route | `apps/web/app/api/session/route.ts` | CREATE — usa `createOrGetSession` de `lib/auth.ts` |
| API route | `apps/web/app/api/draft/route.ts` | CREATE |
| API route | `apps/web/app/api/upload-url/route.ts` | JÁ EXISTE — adicionar requireAceite + rate limit; **trocar `getOrCreateSessionId` local por `createOrGetSession` de `lib/auth.ts`** (evita duplicar sign/verify de JWT) |
| API route | `apps/web/app/api/submit/route.ts` | CREATE |
| Page | `apps/web/app/abertura/confirmacao/page.tsx` | CREATE |
| Env | `apps/web/.env.local` | MODIFY — SESSION_EXPIRY_SECONDS=7200 |
| Infra | `infra/local/init.sh` | MODIFY — adicionar Lifecycle Rule no S3 |

## Critérios de aceite

### Autenticação
- [x] Todas as rotas de dados verificam `prolink_aceite` (Spec 007) — retornam 403 sem ele
- [x] `POST /api/session` só cria sessão se `prolink_aceite` for válido
- [x] Session TTL é **2 horas** (`SESSION_EXPIRY_SECONDS=7200`)
- [x] `requireSession()` consulta DynamoDB a cada request — retorna 403 se sessão não existe ou `status === 'enviado'`
- [x] No submit: `status` atualizado para `'enviado'` no DynamoDB **antes** de invalidar o cookie — token JWT reusado dentro do TTL é bloqueado server-side

### Funcional
- [x] `POST /api/session` cria cookie `prolink_session` httpOnly e retorna `{ ok: true }`
- [x] `GET /api/draft` retorna rascunho do DynamoDB (ou `null`) para a sessão autenticada
- [x] `POST /api/draft` salva rascunho validado com Zod no DynamoDB com TTL de 2h
- [x] `POST /api/upload-url` retorna apenas `{ url }` — sem expor key ou sessionId
- [x] Após upload, `POST /api/draft` com `{ uploadedCampo }` persiste a key em `documentosKeys`
- [x] `POST /api/submit` valida payload Zod, gera protocolo, copia docs S3, publica SQS, invalida `prolink_session`
- [x] Página `/abertura/confirmacao?protocolo=PRO-2026-000001` exibe protocolo e próximos passos — verificado via SSR (curl), não clicado em navegador real nesta sessão (sem ferramenta de browser disponível)
- [x] Rascunho é restaurado automaticamente no reload da página `/abertura` — backend (`GET /api/draft`) verificado via curl; wiring do `StepperEngine` (`useEffect` + `methods.reset`) implementado mas não clicado em navegador real

### Segurança
- [x] `POST /api/draft` valida payload com `aberturaFormObjectSchema.strict().partial()` (`aberturaFormDraftSchema`) — rejeita campos desconhecidos (`.superRefine()` do schema original não expõe `.partial()`, ver decisão de design no batch)
- [x] Keys S3 nunca vêm do cliente — sempre derivadas server-side de `sessionId + campo`
- [x] Lifecycle Rule no S3: delete após 30 dias para prefixos não finalizados — implementada por **tag** (`retention=rascunho`), não por `Prefix:""` como no JSON de exemplo da seção Design (que apagaria também os backups em `protocolos/`) — ver decisão de design no batch
- [x] No submit: docs copiados para `protocolos/{protocolo}/` e prefixo `{sessionId}/` deletado
- [x] Rate limiting em `/api/upload-url`: 20 req/min por IP — retorna 429 ao exceder — testado com 25 requests seguidas (20× 403, 5× 429)
- [ ] CORS S3 em produção: apenas `PUT` e `HEAD`, origin restrito ao domínio — configurado apenas para local (`localhost:3000` em `infra/local/init.sh`); infra de produção está fora do escopo desta spec ("Deploy em produção (Lightsail)")

### TTL / retenção de dados (LGPD Art. 16)
- [x] Rascunhos gravados com `ttl = now + 7200s` (2h)
- [x] No submit: `payload` e `documentosKeys` zerados no mesmo `UpdateItem` que muda status para `'enviado'`; `ttl` redefinido para `now + 30 dias`
- [x] Item COUNTER não recebe TTL
- [ ] Lambda worker zera `payload` e `documentosKeys` se ainda presentes ao consumir a mensagem SQS (defesa em profundidade) — worker é Fase 7 (spec futura, ainda sem número), fora do escopo desta spec; não implementável até essa spec existir

> TTL do aceite LGPD (5 anos) já é responsabilidade da Spec 007 (`done`) — não repetir aqui.

### Qualidade
- [x] Lint passando (`npm run lint`)
- [x] Build sem erros (`npm run build`)
- [x] `upload-url/route.ts` reusa `createOrGetSession` de `lib/auth.ts` — sem lógica de sign/verify de JWT duplicada
- [x] Teste manual com Floci local: fluxo completo funciona (aceite → sessão → draft → upload → submit) — testado via curl + aws cli contra Floci real; bug encontrado e corrigido (`marcarEnviado` não atualizava `tipo`)

## Notas

- Usar `@aws-sdk/client-dynamodb` + `@aws-sdk/lib-dynamodb` (DynamoDBDocument client — API mais simples)
- `AWS_ENDPOINT_URL` no `.env.local` aponta para `http://localhost:4566` (Floci)
- `campo` validado com `/^[a-z0-9_]{1,80}$/` em `upload-url/route.ts` — manter o contrato em toda rota que aceite `campo`
- Cookie `prolink_session` invalidado após submit: `maxAge: 0`
- Cookie `prolink_aceite` NÃO é invalidado no submit — persiste para futuras solicitações (alteração de contrato etc.)
- Rate limiter em memória é suficiente para MVP (Next.js single instance); substituir por DynamoDB counter ao escalar
- Tabela `fichas-abertura` (PK `sessionId`, esta spec) e tabela `prolink-aceites-lgpd` (PK `sessionId` + SK `versaoTermo`, Spec 007) já existem e são independentes — decisão tomada na 007, não reabrir aqui
- `sessionId` do aceite (`prolink_aceite`) e `sessionId` do rascunho (`prolink_session`) são gerados independentemente e não se correlacionam (ver seção "DynamoDB — item de aceite LGPD" acima) — comportamento aceito por simplicidade, não é bug

## Notas de implementação (batch 2026-07-01/02)

Decisões tomadas durante a implementação que refinam ambiguidades da spec original (detalhes completos em `.claude/tasks/todo.md`, seção "Decisão de design"):

1. **Bootstrap do item de rascunho**: `createOrGetSession()` (`lib/auth.ts`) cria o item inicial no DynamoDB (`ensureRascunhoInicial`, idempotente) sempre que gera uma sessão nova. Resolve o problema de bootstrap de `requireSession()` (aplicado literalmente, a primeira chamada a `POST /api/draft` sempre retornaria 403 antes do item existir). `requireSession()` é aplicado em `GET/POST /api/draft` e `POST /api/submit`; não em `POST /api/upload-url` (rota de bootstrap, mesmo motivo pelo qual a spec não a lista na tabela "Camadas afetadas").
2. **`aberturaFormSchema.partial()` não existe**: o schema usa `.superRefine()`, que retorna `ZodEffects` (sem `.partial()`). Criado `aberturaFormObjectSchema` (antes do refine) em `packages/shared/src/schemas/abertura.ts`, e `aberturaFormDraftSchema = aberturaFormObjectSchema.strict().partial()` para uso em `POST /api/draft`.
3. **`POST /api/draft` com `{ uploadedCampo }` também recebe `contentType`**: necessário para derivar a mesma extensão usada em `upload-url` (`{sessionId}/documentos/{campo}.{ext}`), já que o servidor não persiste o `contentType` entre as duas chamadas.
4. **Lifecycle Rule do S3 por TAG, não por Prefix**: o JSON de exemplo na seção Design (`Filter: {Prefix: ""}`) apagaria também os backups permanentes em `protocolos/{protocolo}/`, contradizendo "Backup real está no S3" (tabela de TTL do DynamoDB). Implementado com tag `retention=rascunho` gravada em `getPresignedUploadUrl` e removida em `copyObject` (`TaggingDirective: REPLACE`) — assim só rascunhos abandonados expiram em 30 dias.
5. **Bug corrigido durante teste manual**: `marcarEnviado` não atualizava o campo `tipo` do item — se o usuário mudasse `tipoConstituicao` entre um draft salvo e o submit final, o item ficava com o `tipo` desatualizado (a mensagem SQS já usava o valor correto, vindo do payload validado). Corrigido: `marcarEnviado(sessionId, protocolo, tipo)` agora recebe e regrava o `tipo` confirmado no submit.
6. **`ConfirmacaoModal.tsx` removido**: o fluxo anterior mostrava um modal in-page ao "enviar". Substituído pela página real `/abertura/confirmacao` (exigida pelo critério de aceite); o componente modal ficou órfão (zero referências) e foi deletado.
