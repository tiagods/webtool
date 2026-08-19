---
id: "019"
title: "Centralizar autenticação/config dos clients AWS em aws/config.ts"
status: draft          # draft | review | approved | in-progress | done | rejected
created: 2026-07-13
author: "tiagods"
batch_size: "small"    # small (≤ meio dia) | medium (≤1 dia)
depends_on: ["018"]    # aws/config.ts consome os valores resolvidos de lib/config.ts (config.aws.*)
---

# Centralizar autenticação/config dos clients AWS em aws/config.ts

## Contexto

Cada client AWS (`dynamodb.ts`, `sqs.ts`, `s3.ts`) monta sua própria configuração de
conexão/autenticação com o **mesmo bloco duplicado**:

```ts
{
  region: process.env.AWS_REGION ?? 'us-east-1',
  ...(process.env.AWS_ENDPOINT_URL
    ? {
        endpoint: process.env.AWS_ENDPOINT_URL,
        credentials: {
          accessKeyId:     process.env.AWS_ACCESS_KEY_ID     ?? 'test',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'test',
        },
      }
    : {}),
}
```

O S3 é a única variação — acrescenta `forcePathStyle: true` dentro do ramo de endpoint local.

Consequência: a estratégia de autenticação está **espalhada em 3 arquivos**. Trocar o modelo
(por exemplo, passar a usar **IAM roles** em produção — sem credenciais explícitas, deixando
o SDK resolver via cadeia de credenciais padrão) obrigaria a editar todos os pontos, com
risco de inconsistência.

## Objetivo

- Criar `apps/api/lib/aws/config.ts` como **ponto único** que produz a configuração base dos
  clients AWS (region + resolução de credenciais/endpoint).
- Refatorar `dynamodb.ts`, `sqs.ts` e `s3.ts` para consumir essa config, preservando a
  particularidade do S3 (`forcePathStyle`) via composição.
- Deixar a **autenticação centralizada**: mudar para IAM roles (ou outra estratégia) passa a
  ser uma alteração em **um único arquivo**.
- Sem mudança de comportamento observável — local (via `AWS_ENDPOINT_URL` + credenciais
  `test`) e produção (sem endpoint) continuam funcionando igual.

## Fora de escopo

- Não implementar de fato o suporte a IAM roles agora — apenas deixar a base pronta para
  que essa troca seja local. (Pode virar spec futura.)
- Não alterar a lógica de negócio de cada client (queries, comandos, presign).
- Não mexer em `apps/web` nem `apps/worker`.

## Design

### `apps/api/lib/aws/config.ts`

Expõe a config base compartilhada. Os valores vêm de `config.aws.*` (spec 018) — que é o
único ponto que lê `process.env`. Esta fábrica apenas decide **como** montar a config do
client a partir deles:

```ts
import { config } from '@/lib/config';

/**
 * Configuração base de autenticação/conexão dos clients AWS.
 * Ponto ÚNICO para trocar a estratégia de credenciais (ex.: IAM roles).
 *
 * - Com endpoint definido (dev/local via Floci): usa endpoint + credenciais fixas.
 * - Sem endpoint (produção): retorna só a region e deixa o SDK resolver credenciais pela
 *   cadeia padrão (env vars, IAM role da instância/task, etc.) — pronto para IAM roles.
 */
export function awsClientConfig(): {
  region: string;
  endpoint?: string;
  credentials?: { accessKeyId: string; secretAccessKey: string };
} {
  const { region, endpointUrl, accessKeyId, secretAccessKey } = config.aws;

  if (!endpointUrl) return { region };

  return {
    region,
    endpoint: endpointUrl,
    credentials: { accessKeyId, secretAccessKey },
  };
}
```

### Uso nos clients

```ts
// dynamodb.ts
const client = new DynamoDBClient(awsClientConfig());

// sqs.ts
const client = new SQSClient(awsClientConfig());

// s3.ts — mantém a particularidade por composição
const base = awsClientConfig();
const client = new S3Client({
  ...base,
  ...(base.endpoint ? { forcePathStyle: true } : {}),
});
```

### Camadas afetadas

| Camada | Arquivo | Ação |
|--------|---------|------|
| API | `apps/api/lib/aws/config.ts` | **CREATE** (config base de auth) |
| API | `apps/api/lib/aws/dynamodb.ts` | EDIT (usar `awsClientConfig`) |
| API | `apps/api/lib/aws/sqs.ts` | EDIT (usar `awsClientConfig`) |
| API | `apps/api/lib/aws/s3.ts` | EDIT (usar `awsClientConfig` + `forcePathStyle`) |

## Critérios de aceite

- [ ] `apps/api/lib/aws/config.ts` criado como ponto único da config de autenticação AWS
- [ ] `dynamodb.ts`, `sqs.ts` e `s3.ts` não montam mais a config inline — consomem `awsClientConfig()`
- [ ] Particularidade `forcePathStyle` do S3 preservada (só quando há endpoint local)
- [ ] Nenhuma mudança de comportamento em dev (endpoint local) nem produção (sem endpoint)
- [ ] Lint passando (`npm run lint`)
- [ ] Build passando (`npm run build`)

## Notas

- **Relação com a spec 018** (decisão aprovada): esta 019 **depende da 018**. A 018 cria
  `apps/api/lib/config.ts` (único ponto que lê `process.env`, incluindo `config.aws.*`) e a
  019 monta a config dos clients AWS a partir desses valores já resolvidos — `aws/config.ts`
  **não** lê `process.env` diretamente. Ordem: fazer a 018 antes da 019.
- **IAM roles**: no ramo "sem endpoint", ao **não** passar `credentials`, o SDK v3 já resolve
  pela cadeia padrão de credenciais (inclui IAM role de instância/ECS task). O objetivo desta
  spec é justamente tornar essa transição uma edição de 1 arquivo.
