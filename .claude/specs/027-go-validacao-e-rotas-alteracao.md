---
id: "027"
title: "Go — validação da Ficha de Alteração + rotas de rascunho e submit"
status: done
created: 2026-09-07
author: "tiagods"
batch_size: "medium"
depends_on: ["026"]
---

# Go — validação da Alteração + rascunho + submit

## Contexto

O pedaço mais difícil do port: `packages/shared/src/schemas/alteracao.ts` (~245–270 LOC) tem
união discriminada (`cedente`/`cessionario`), 9 sub-schemas por quadro (Q01–Q09) e vários
`superRefine` condicionais.

## Pré-tarefa

Estender a suíte de caracterização (spec 025) com payloads de Alteração — veredito esperado
gravado a partir do `apps/api` Node.

## Objetivo

- Validador Go de `AlteracaoForm`:
  - `identificacao`: apenas `situacao == "ativa"` prossegue
  - união discriminada `membro` por `tipo` (`cedente` sem pró-labore/admin; `cessionario` com)
  - cada quadro em `quadros[]` selecionado exige o bloco `qNN` correspondente preenchido
  - refines condicionais: Q04 (`cnpjAnterior` se `participacaoAnterior == "sim"`),
    Q05 (`valorIntegralizacao` + `especificarIntegralizacao` se `aumento`),
    Q07 (`especificar` se `outras`)
  - draft: `strict + partial`, `aceite` opcional
- `alteracao` usa tabela própria (`AWS_DYNAMODB_ALTERACAO_TABLE`)
- rotas:
  - `GET /api/alteracao/draft` → `{payload}`
  - `POST /api/alteracao/draft`
  - `POST /api/alteracao/submit` — `proximoProtocolo("ALT-", tabelaAlteracao)`,
    `putJsonObject("protocolos/{protocolo}/alteracao.json", payload)` (sem cópia de arquivos),
    SQS `formType: "alteracao"`, `marcarEnviado`, expira cookie

## Fora de escopo

- Qualquer mudança nas rotas de Abertura.
- Worker.

## Critérios de aceite

- [x] Validador Go reproduz o veredito da suíte de caracterização para todos os payloads de Alteração
- [x] União discriminada e refines condicionais por quadro cobertos por testes de tabela
- [x] `GET/POST /api/alteracao/draft` e `POST /api/alteracao/submit` com contrato idêntico ao Node (testes caixa-preta `adapter/web`)
- [x] Fluxo E2E de Alteração → protocolo `ALT-2026-000001`, JSON verbatim no S3, mensagem `formType:"alteracao"` na fila, `fichas-abertura` sem item órfão (exercido direto contra o container `api-go:3002` — o Go ainda não está no nginx; cutover é a spec 028)
- [x] `go vet`/`gofmt`/`golangci-lint` + `go test ./... -race` verdes; `docker compose build api-go` verde

## Notas

- Considerar quebrar em 027a (validação) + 027b (rotas) se o batch passar de 1 dia.
