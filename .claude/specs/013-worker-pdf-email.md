---
id: "013"
title: "Worker (container Docker) — Geração de PDF e E-mail (Fase 7)"
status: draft
created: 2026-07-07
author: "Claude"
batch_size: "medium"
depends_on: ["008"]
---

# Worker (container Docker) — Geração de PDF e E-mail (Fase 7)

> **Rascunho — a aprofundar em discussão antes de aprovar.** Layout do PDF e escopo do e-mail (só interno x confirmação para o cliente) ainda em aberto. A decisão de deploy já está fechada: **container Docker** long-running na mesma stack Compose, **não Lambda** (ver Notas).

## Contexto

Desde a Spec 008 (`done`), `POST /api/submit` já publica uma mensagem no SQS ao final do envio de uma ficha — mas **não existe consumidor**. `apps/worker` está citado em `docs/arquitetura.md` e no `CLAUDE.md` raiz ("[Planned Phase 7]"), mas o diretório não existe no repositório. Hoje, toda mensagem publicada na fila fica parada indefinidamente: nenhum PDF é gerado, nenhum e-mail é enviado — ou seja, **o fluxo de ponta a ponta ainda não notifica ninguém quando uma ficha é enviada**, que é o objetivo final de todo o sistema.

A Spec 008 também deixou um critério de segurança explicitamente pendente até esta spec existir (`273`): o worker deve zerar `payload`/`documentosKeys` no DynamoDB (se ainda presentes) ao consumir a mensagem, como defesa em profundidade LGPD.

### Por que container e não Lambda

- Nenhuma infraestrutura como código (Terraform/CDK/SAM) existe no repositório. Introduzir Lambda agora significa introduzir também o primeiro pipeline de deploy de função gerenciada — custo desproporcional para o primeiro consumidor.
- A stack já roda em Docker Compose (Lightsail hoje, Fargate no futuro). Um serviço `worker` a mais na mesma `docker-compose*.yml` reaproveita build, rede, credenciais e fluxo de deploy (`deploy.md`) já existentes.
- Volume esperado (~100 fichas/mês) não justifica escala a zero. Um container ocioso fazendo long-polling na SQS custa perto de nada no plano Lightsail já contratado.
- **Migração para Lambda no futuro fica barata** se a lógica de processamento de uma mensagem for uma função pura, isolada do loop de polling (ver Design). O handler Lambda passaria a ser só um wrapper fino sobre a mesma função.

## Objetivo

Criar `apps/worker` como **processo Node.js/TS standalone** (não Next.js), empacotado em container Docker e adicionado à stack Compose, que:

1. Faz long-polling na fila SQS `prolink-abertura` (mesma mensagem publicada pelo `/api/submit`).
2. Para cada mensagem: busca o payload no DynamoDB, gera o PDF da ficha, sobe o PDF para o S3 e dispara o e-mail de notificação.
3. Zera `payload`/`documentosKeys` no DynamoDB se ainda presentes (defesa em profundidade LGPD).
4. Deleta a mensagem da fila só após sucesso; em falha, deixa a mensagem voltar para a fila (visibility timeout) até a DLQ após `maxReceiveCount`.

## Fora de escopo

- Qualquer mudança em `apps/api` / `apps/web` — o contrato da mensagem SQS já está estável desde a Spec 008 (`{ sessionId, protocolo, tipo, formType }`).
- Consumo das mensagens da Ficha de Alteração Contratual (Spec 012). O worker desta spec trata apenas `formType: 'abertura'`; `formType: 'alteracao'` é reconhecido e **re-enfileirado/ignorado sem erro** até a spec de integração das duas.
- Provisionamento de Lambda / IaC — migração futura, spec própria.
- **IAM Task Role e ECS Task Definition do worker em produção** — são da [`Spec 021`](021-aws-iam-roles-iac-producao.md), que já desenha `prolink-worker-task-role` (menor privilégio: DynamoDB `GetItem`/`UpdateItem`, S3, SNS `Publish`, SQS `Receive`/`Delete`/`GetQueueAttributes`) e `worker.taskdef.json`. Esta spec produz a imagem e o código; a 021 define a role/taskdef.
- Dashboard/observabilidade além de logs estruturados em stdout.

## Design

### Camadas / arquivos afetados

| Camada | Arquivo | Ação |
|--------|---------|------|
| Worker | `apps/worker/package.json` | CREATE — deps: `@aws-sdk/client-sqs`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-s3`, `@aws-sdk/client-sns`, `@react-pdf/renderer`, `@prolink/shared` |
| Worker | `apps/worker/tsconfig.json` | CREATE — `extends ../../tsconfig.base.json` |
| Worker | `apps/worker/src/index.ts` | CREATE — bootstrap: monta o loop de polling, registra handlers de `SIGTERM`/`SIGINT` |
| Worker | `apps/worker/src/poller.ts` | CREATE — loop `ReceiveMessage` (WaitTimeSeconds 20), orquestra ack/nack, backoff em erro de rede |
| Worker | `apps/worker/src/processMessage.ts` | CREATE — **função pura de processamento de UMA mensagem** (ponto de reuso para Lambda futura) |
| Worker | `apps/worker/src/steps/fetchFicha.ts` | CREATE — lê item do DynamoDB por `sessionId` |
| Worker | `apps/worker/src/steps/gerarPdf.tsx` | CREATE — template `@react-pdf/renderer` da ficha de abertura |
| Worker | `apps/worker/src/steps/uploadPdf.ts` | CREATE — `PutObject` em `protocolos/{protocolo}/ficha.pdf` |
| Worker | `apps/worker/src/steps/notificar.ts` | CREATE — `Publish` no SNS `prolink-abertura-emails` |
| Worker | `apps/worker/src/steps/limparDados.ts` | CREATE — `UpdateItem` zerando `payload`/`documentosKeys` se presentes |
| Worker | `apps/worker/src/config.ts` | CREATE — lê env vars (mesma convenção de `apps/api`), valida na inicialização |
| Worker | `apps/worker/src/aws.ts` | CREATE — factory dos clients AWS **espelhando `awsClientConfig()` da Spec 019** (`apps/api/lib/aws/config.ts`): com `AWS_ENDPOINT_URL` → endpoint + credenciais `test`; sem endpoint → só `{ region }`, SDK resolve pela cadeia padrão (Task Role do Fargate — Spec 021). Não reinventar a montagem de credenciais. |
| Worker | `apps/worker/Dockerfile` | CREATE — multi-stage Node 20-alpine, `CMD ["node", "dist/index.js"]` |
| Infra | `docker-compose.yml` | EDIT — serviço `worker` (depends_on floci healthy; env vars AWS de dev) |
| Infra | `docker-compose.prod.yml` | EDIT — serviço `worker` (sem endpoint/keys — IAM/env do host; `restart: unless-stopped`) |
| Infra | `infra/local/init.sh` | EDIT (se necessário) — criar DLQ `prolink-abertura-dlq` + redrive policy na fila |
| Docs | `docs/arquitetura.md`, `docs/aws.md`, `CLAUDE.md`, `README.md` | EDIT — trocar "Lambda" por "worker container" no fluxo e nas tabelas |

### Contrato da mensagem (já publicado pela Spec 008)

```jsonc
{
  "sessionId": "uuid-v4",
  "protocolo": "PRO-2026-000001",
  "tipo": "ltda | slu",
  "formType": "abertura | alteracao"   // 'alteracao' é ignorado nesta spec
}
```

### Função de processamento (isolada do transporte)

```ts
// apps/worker/src/processMessage.ts
export interface ProcessDeps {
  fetchFicha: (sessionId: string) => Promise<FichaItem>;
  gerarPdf: (ficha: FichaItem) => Promise<Buffer>;
  uploadPdf: (protocolo: string, pdf: Buffer) => Promise<string>;   // retorna s3 key/url
  notificar: (evento: EmailEvent) => Promise<void>;
  limparDados: (sessionId: string) => Promise<void>;
  logger: Logger;
}

// Pura em relação ao SQS: recebe o corpo já parseado, lança em falha.
// Um handler Lambda futuro chama exatamente esta função por record.
export async function processMessage(msg: SubmitMessage, deps: ProcessDeps): Promise<void>;
```

```ts
// apps/worker/src/poller.ts  (only lives in the container path)
// while (running):
//   res = sqs.ReceiveMessage({ MaxNumberOfMessages: 5, WaitTimeSeconds: 20, VisibilityTimeout: 120 })
//   for each message (em paralelo, Promise.allSettled):
//     try { await processMessage(JSON.parse(body), deps); await sqs.DeleteMessage(...) }
//     catch { log erro; NÃO deleta — volta à fila após VisibilityTimeout → DLQ após maxReceiveCount }
```

### Deploy — serviço Compose

```yaml
# docker-compose.yml (dev)
worker:
  build: { context: ., dockerfile: apps/worker/Dockerfile }
  container_name: prolink-worker
  depends_on:
    floci: { condition: service_healthy }
  environment:
    AWS_ENDPOINT_URL: http://floci:4566
    AWS_REGION: us-east-1
    AWS_ACCESS_KEY_ID: test
    AWS_SECRET_ACCESS_KEY: test
    AWS_DYNAMODB_TABLE: fichas-abertura
    AWS_S3_BUCKET: prolink-fichas
    AWS_SQS_QUEUE_URL: http://floci:4566/000000000000/prolink-abertura
    AWS_SNS_TOPIC_ARN: arn:aws:sns:us-east-1:000000000000:prolink-abertura-emails
  restart: unless-stopped
```

Em `docker-compose.prod.yml`: mesmo serviço sem `AWS_ENDPOINT_URL`/keys (cadeia de credenciais padrão do SDK — IAM role no Fargate, env do host no Lightsail), vars vindas do `.env` como os demais serviços.

### Erro / retry

- **Retry**: nativo do SQS via visibility timeout. Sem delete = reentrega.
- **DLQ**: `prolink-abertura-dlq` com `maxReceiveCount: 5` na redrive policy da fila principal (criada no `init.sh` em dev; no provisionamento AWS em prod — `docs/aws.md`).
- **Reprocessamento**: manual (redrive da DLQ para a fila) nesta fase.
- **Idempotência**: `uploadPdf` sobrescreve a mesma key; `notificar` pode reenviar e-mail em caso de reprocessamento — aceitável nesta fase (documentar).

## Critérios de aceite

- [ ] `apps/worker` builda e sobe como serviço `worker` em `docker compose up` (dev, com Floci)
- [ ] Mensagem publicada na fila por `POST /api/submit` (`formType: 'abertura'`) é consumida em < 30s
- [ ] PDF da ficha é gerado e persistido em `s3://prolink-fichas/protocolos/{protocolo}/ficha.pdf`
- [ ] Evento publicado no SNS `prolink-abertura-emails` com `{ protocolo, nomeEmpresa, pdfUrl, documentosUrl[] }`; e-mail chega em `contato@prolinkcontabil.com.br` via subscription SES
- [ ] Worker zera `payload` e `documentosKeys` no DynamoDB se ainda presentes ao consumir a mensagem (herdado da Spec 008 `273`)
- [ ] Mensagem só é deletada da fila após sucesso; falha simulada (ex.: payload ausente) mantém a mensagem e após 5 tentativas ela cai na DLQ `prolink-abertura-dlq`
- [ ] `formType: 'alteracao'` é ignorado sem erro e sem estourar a DLQ
- [ ] `processMessage()` não importa nada do `@aws-sdk/client-sqs` — recebe deps por injeção (garantia de portabilidade para Lambda)
- [ ] `SIGTERM` encerra o loop após terminar as mensagens em voo (shutdown gracioso)
- [ ] `docker-compose.prod.yml` tem o serviço `worker` sem endpoint/keys hardcoded
- [ ] Docs atualizadas (`docs/arquitetura.md`, `docs/aws.md`, `CLAUDE.md`, `README.md`) — "worker container", não "Lambda"
- [ ] Lint passando (`npm run lint`)
- [ ] Testes unitários de `processMessage` (deps mockadas) passando

## Notas

- **Decisão de deploy (fechada nesta sessão)**: worker é um container Docker long-running na mesma stack Compose. Lambda fica para o futuro, se/quando o volume ou o custo do container ocioso justificar — a função `processMessage` já nasce preparada para esse wrapper.
- Fluxo de referência: `docs/arquitetura.md` seção "Worker (consumidor SQS)"; `docs/aws.md` seção "Worker (consumidor SQS)".
- E-mail continua indo via **SNS → SES subscription** (worker publica no SNS, não chama SES direto) — mantém o desacoplamento já documentado e permite outras subscriptions (Slack, webhook) depois.
- Layout do PDF: decidir entre replicar a ficha Word de `fichas/` ou um resumo enxuto — pendente com o usuário.
- Escopo do e-mail: só equipe interna (documentado) ou também confirmação ao cliente — pendente com o usuário.
