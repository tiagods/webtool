---
id: "023"
title: "Go — camada de infraestrutura AWS (ports + adapters DynamoDB/S3/SQS)"
status: done
created: 2026-09-07
author: "tiagods"
batch_size: "medium"
depends_on: ["022"]
---

# Go — camada de infraestrutura AWS (ports + adapters)

## Contexto

O scaffold da spec 022 entrega config validada, `cmd/api` com `/healthz` e o Dockerfile, mas
nenhum acesso a AWS. Toda a lógica de `apps/api/lib/aws/{dynamodb,s3,sqs}.ts` precisa ser
portada para Go antes que qualquer handler funcione.

## Objetivo

- Definir os **ports** em `domain/ports` consumidos pelos serviços de domínio:
  `DraftRepository`, `AceiteRepository`, `ObjectStorage`, `EventPublisher`, `ProtocoloCounter`.
- Implementar os adapters em `infrastructure/aws/`:
  - `config.go` — monta os clients `aws-sdk-go-v2` com override de endpoint (Floci:
    `BaseEndpoint` + `UsePathStyle` no S3 + credenciais estáticas) ou cadeia padrão (prod).
  - `dynamodb.go` — `getRascunho`, `putRascunho`, `ensureRascunhoInicial` (UpdateItem
    `if_not_exists`), `putDocumentoKey`, `marcarEnviado` (zera payload/keys + TTL 30d),
    `proximoProtocolo` (contador atômico `ADD seq`, `ReturnValues: UPDATED_NEW`),
    `putRegistroAceite` (TTL 5 anos), `deleteDraft`. TTLs 2h/30d/5a no atributo `ttl`.
  - `s3.go` — `getPresignedUploadUrl` (PUT, 300s, `Tagging: retention=rascunho`),
    `putJsonObject`, `copyObject` (`TaggingDirective: REPLACE`, `Tagging: ""`),
    `deleteObjectsWithPrefix` (`ListObjectsV2` + `DeleteObjects`), helpers de content-type.
  - `sqs.go` — `publishSubmissao` (`SendMessage`, body JSON `{sessionId, protocolo, formType, tipo?}`).
- `golangci-lint` + `.golangci.yml` introduzidos aqui; `make lint` passa a incluí-lo.
- Testes de integração contra Floci sob build tag `//go:build integration`.

## Fora de escopo

- Handlers HTTP, auth/JWT, validação de payload (specs 024+).
- SNS/SES/STS (worker — spec 013).

## Design

Entities novas em `domain/entity`: `Rascunho`, `RegistroAceite`, `SubmissaoMessage`,
`TipoConstituicao`, `FormType`, `RascunhoStatus`. Ports recebem/devolvem só esses tipos +
`context.Context`. Cada adapter tem construtor explícito (`NewDynamoDraftRepository(client, table)`),
sem estado global.

Mapa DynamoDB ⇆ Go: usar `feature/dynamodb/expression` para montar `UpdateExpression` e
`attributevalue` para marshal/unmarshal. `payload`/`documentosKeys` são mapas dinâmicos —
guardar como `map[string]any` / `json.RawMessage` conforme necessário.

## Critérios de aceite

- [x] Ports em `domain/ports/outbound` com doc-comment, **agrupados por entidade** (não por
  tipo de operação — ver `boas-praticas-go` §5, revisado nesta spec)
- [x] Adapters `infrastructure/aws/{config,dynamodb,s3,sqs}.go` implementando os ports
- [x] Override de endpoint Floci vs cadeia padrão validado (config da spec 022)
- [x] Testes de integração (`//go:build integration`) contra Floci: put/get rascunho, contador sequencial, presign PUT, copy+untag, delete por prefixo, publish SQS — **6/6 PASS**
- [x] `make lint` (agora com `golangci-lint`) e `make test` verdes
- [x] `docker compose build api-go` verde

## Notas

- Contador `proximoProtocolo`: item de controle `sessionId: "COUNTER"` por tabela, sem TTL.
- `marcarEnviado` escreve `payload = null` + `documentosKeys = null` no **mesmo** UpdateItem
  que muda `status` para `enviado` (defesa em profundidade LGPD).
- **Ports por entidade, não por operação**: `RascunhoRepository` tem 6 métodos (não foi
  dividido em reader/writer). `domain/ports/` passa a ter `inbound/` e `outbound/` —
  esta spec só cria `outbound/` (os `inbound` vêm com os casos de uso, specs 024+).
- **Dependências novas** (`go.mod`): `aws-sdk-go-v2` v1.46, `config`, `credentials`,
  `service/{dynamodb,s3,sqs}`, `feature/dynamodb/{attributevalue,expression}`. Clients com
  `BaseEndpoint` + `UsePathStyle` (S3) só quando `cfg.UsesCustomEndpoint()`.
- **Mapeamento entity ⇆ DynamoDB**: DTOs `rascunhoItem`/`aceiteItem` com tags `dynamodbav`
  vivem no adapter; as entities de `domain/` ficam sem tags de storage. `payload` é `map[string]any`
  (Map nativo, compatível com o reader Node durante o cutover); `createdAt`/`updatedAt` são
  ISO 8601 no item e `time.Time` na entity.
- **golangci-lint**: exige **≥ v2.13** (v2.5 quebra em Go 1.27 — "export data version 4").
  `misspell` fora do preset (comentários em pt-BR). O builder Docker mantém só `go vet` como gate.
- Entity `RegistroAceite.AceitoEm` é `string` (ISO), espelhando `registroAceiteSchema` de
  `@prolink/shared`; o TTL de 5 anos é derivado no adapter.
