# Spec 034 — Testes Integrados de APIs e Worker

| Campo | Valor |
|-------|-------|
| Data | 2026-09-20 |
| Status | in-progress |
| Domínio | `apps/backend/infrastructure/` |

## Objetivo

Criar testes integrados reais (end-to-end via floci) para os endpoints HTTP da API e para o
consumer do worker em `apps/backend/infrastructure/`. Os recursos AWS (DynamoDB, S3, SQS) são
criados e gerenciados via floci, mock de email é injetado, e os testes validam fluxos completos
do mundo real — não apenas unidades isoladas.

## Escopo

### O que testar

1. **Fluxos HTTP completos** (abertura + alteração): session → draft → upload → submit
2. **Cenários de borda dos handlers**: payload inválido, sessão inexistente, sessão já enviada,
   duplo submit, concorrência de drafts
3. **Consumer do worker**: `NotificarSubmissao.Processar` chamado diretamente (sem polling loop),
   validando abertura, alteração e mensagens inválidas

### O que NÃO testar (já coberto)

- Validação campo a campo: `domain/validation/*_test.go` + characterization suite
- Lógica pura de serviços: `domain/service/*_test.go` com gomock
- Handlers com fakes puros: `adapter/web/*_test.go` com httptest + fakes
## Plano de Testes

### 1. `api_submit_abertura_integration_test.go`

**1.1 Fluxo feliz completo — Abertura**
Setup: 1 tabela Dynamo, 1 bucket S3, 1 fila SQS.
1. `POST /api/session` → 201 `{ sessionId }` + cookie `prolink_session`
2. `POST /api/draft` com payload válido (Ltda, 1 sócio) → 200
3. `POST /api/upload-url` para `contrato_social` → presigned URL
4. PUT real no S3 via URL presigned → 200
5. `GET /api/draft` → 200 com payload gravado + docs
6. `POST /api/submit` → 200 `{ protocolo: "PRO-2026-NNNNNN" }` + cookie expirado
7. Mensagem SQS com `sessionId`, `protocolo`, `formType`, `tipo`
8. Email mock: 1 envio com assunto `"Nova abertura — ..."`

**1.2 Submit sem docs (SLU, sem sócios adicionais)**
session → draft SLU → submit (sem upload) → 200.

**1.3 Protocolo sequencial**
Dois submits consecutivos com sessões diferentes → protocolos `000001`, `000002`.

### 2. `api_submit_alteracao_integration_test.go`

**2.1 Fluxo feliz — Alteração**
1. `POST /api/alteracao/session` → 201
2. `POST /api/alteracao/draft` (quadro: objeto_social) → 200
3. `GET /api/alteracao/draft` → 200
4. `POST /api/alteracao/submit` → 200 `{ protocolo: "ALT-2026-NNNNNN" }`
5. Mensagem SQS com `formType: "alteracao"`, sem `tipo`

**2.2 Submit alteração sem tipo**
JSON da mensagem SQS não contém campo `tipo` (omitempty para FormAlteracao).

### 3. `api_borda_integration_test.go`

**3.1 Payload inválido → 400**
`POST /api/submit` com `{"dadosEmpresa":{}}` → 400 `{error:"Payload inválido", issues:[...]}`

**3.2 Sessão inexistente → 403**
`POST /api/draft` com cookie inválido → 403

**3.3 Sessão já enviada → 409**
Submit com sessão `status=enviado` → 409

**3.4 Duplo submit → 409**
Segundo submit na mesma sessão → 409

**3.5 DELETE session → limpa S3 + Dynamo**
DELETE com sessão ativa + docs no S3 → 200, bucket limpo, item removido

**3.6 Draft concorrente (último vence)**
Dois `POST /api/draft` com payloads diferentes → GET retorna o último

### 4. `worker_integration_test.go`

**4.1 Worker processa abertura**
Semeia rascunho + S3 objects, publica msg `FormType:"abertura"` → chama
`Processar` → email com assunto `"Nova abertura — ..."` + body HTML com links presigned.

**4.2 Worker processa alteração**
Análogo 4.1 com `FormType:"alteracao"`. Assunto: `"Nova alteração — ..."`.

**4.3 Worker ignora rascunho ausente**
`Processar` com `SessionID` inexistente → `return nil` (sem erro, sem email).

**4.4 Worker ignora formType inválido**
`Processar` com `FormType:"invalido"` → erro `"formType desconhecido"`.

### 5. Dados de teste (`apps/backend/scripts/integration_tests/data/`)

```
apps/backend/scripts/integration_tests/data/
├── s3/
│   ├── contrato_social.pdf       # PDF dummy (bytes mínimos)
│   └── rg_socio_1.jpg            # Imagem dummy
├── dynamodb/
│   ├── rascunho_abertura.json    # Payload válido abertura (Ltda, 1 sócio)
│   ├── rascunho_alteracao.json   # Payload válido alteração
│   └── rascunho_invalido.json    # Payload inválido (só tipo)
└── sqs/
    ├── mensagem_abertura.json     # SubmissaoMessage abertura
    ├── mensagem_alteracao.json    # SubmissaoMessage alteração
    └── mensagem_invalida.json     # SubmissaoMessage formType inválido
```

### 6. Estratégia de recursos

| Recurso | Criação | Compartilhamento | Cleanup |
|---------|---------|-------------------|---------|
| Tabela DynamoDB | Primeiro teste que precisa | Uma por suite | `t.Cleanup` no `TestMain` |
| Bucket S3 | `TestMain` | Compartilhado (`it-bucket`) | `t.Cleanup` (esvazia + deleta) |
| Fila SQS | `TestMain` | Compartilhada (`it-queue`) | `t.Cleanup` |
| Email mock | `montarDeps` customizado | Injetado em todos | N/A |

**Regra**: ao criar recurso, verificar se existe (`HeadBucket`, `DescribeTable`,
`GetQueueUrl`). Se existe, deletar e recriar (garantir estado limpo).

### 7. Helpers reutilizáveis (`infrastructure/testhelpers/setup.go`)

```go
// TestDeps contém os recursos e serviços montados para testes integrados.
type TestDeps struct {
    DynamoTable string
    S3Bucket    string
    SQSQueueURL string
    EchoServer  *echo.Echo
    Clients     *aws.Clients
    EmailMock   *MockEmailSender
}

// SetupIntegration cria recursos floci e monta os serviços.
func SetupIntegration(t *testing.T) *TestDeps { ... }

// MockEmailSender grava os emails enviados para inspeção.
type MockEmailSender struct {
    Enviados []outbound.EmailData
}
```

## Critérios de aceite

- [ ] **CA1** — Todos os 15 cenários implementados em `apps/backend/infrastructure/`
- [ ] **CA2** — Recursos DynamoDB, S3, SQS criados via floci; email mockado
- [ ] **CA3** — Dados de teste em `apps/backend/scripts/integration_tests/data/`
- [ ] **CA4** — `make test-integration` passa com todos os testes verdes
- [ ] **CA5** — Cada `*_test.go` limpa seus recursos; repetível sem intervenção manual
- [ ] **CA6** — Recursos compartilhados criados uma vez (verifica existência, recria)
- [ ] **CA7** — `make test` (unitários) continua passando sem alteração
- [ ] **CA8** — `make lint` (vet + fmt + golangci-lint) passa

## Notas

- O `adapter/event/consumer/` só tem `.gitkeep`. O consumer real é
  `NotificarSubmissao.Processar`, chamado diretamente nos testes.
- O email mock não precisa de SMTP real — só grava `EmailData` para inspeção.
- Payloads válidos podem ser importados de `domain/validation/testdata/casos_abertura.json`
  e `casos_alteracao.json` (reuso da characterization suite).
**4.5 Worker com múltiplos docs**
Rascunho com 5+ `documentosKeys` → email com 5+ links presigned.
- Adapters AWS isolados: `infrastructure/aws/*_integration_test.go`
- Auth, middleware, rate-limit: próprios `*_test.go`

## Não negociaveis

- Build tag `integration`: `//go:build integration`
- Recursos criados via floci (DynamoDB, S3, SQS)
- SMTP mockado: `EmailSender` falso que grava o que recebeu
- Cada `*_test.go` limpa seus recursos no `t.Cleanup`
- Recursos compartilhados criados uma vez via `TestMain` ou helper com cache
- Verificar existência antes de criar (se existe, deletar e recriar)