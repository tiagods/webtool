---
id: "011"
title: "Exclusão de Dados sob Solicitação (LGPD Art. 18)"
status: done
created: 2026-07-07
author: "Claude"
batch_size: "small"
depends_on: ["008"]
---

# Exclusão de Dados sob Solicitação (LGPD Art. 18)

## Contexto

`docs/arquitetura.md` já lista, na tabela de Segurança e LGPD, um "Direito de exclusão" com o endpoint `DELETE /api/session → apaga DynamoDB + S3` marcado como **futuro** — nunca chegou a virar spec. A Spec 008 implementou TTL automático (2h para rascunhos, 30 dias para envios), que cobre o caso de abandono, mas não cobre o caso em que o titular dos dados pede exclusão **antes** do TTL natural expirar (direito garantido pelo Art. 18 da LGPD, independente de prazo de retenção).

## Objetivo

Criar o endpoint `DELETE /api/session` em `apps/api`, que:

- Identifica a sessão pelo cookie `prolink_session` (mesmo mecanismo de `requireSession()` já existente).
- Apaga o item correspondente no DynamoDB.
- Apaga todos os objetos S3 sob o prefixo `{sessionId}/` (documentos ainda não submetidos).
- Invalida o cookie de sessão.
- Se a sessão já tiver `status: 'enviado'` (protocolo gerado, dados já copiados para `protocolos/{protocolo}/`), retornar erro claro — exclusão pós-envio exige processo diferente (o cliente deve contatar a empresa para solicitar a exclusao) pois o processamento ja se iniciou.

## Fora de escopo

- Exclusão de dados já movidos para `protocolos/{protocolo}/` ( `docs/aws.md`)
— exclusão desses dados, se solicitada, é um processo manual/jurídico, não um endpoint self-service.
- UI/botão no frontend para acionar esse endpoint (a spec cobre só a API; se o usuário quiser um botão "excluir meus dados" no formulário, é uma spec de frontend separada).
- Auditoria/log de solicitações de exclusão (pode ser proposto como spec futura se exigido por compliance).

## Design

### Fluxo

```
DELETE /api/session
  │
  ├─ 1. requireSession() — 403 se cookie ausente/inválido ou sessão não existe
  ├─ 2. Busca item no DynamoDB — se status === 'enviado', retorna 409 (dados já protocolados)
  ├─ 3. Lista e deleta todos os objetos S3 sob {sessionId}/ (DeleteObjects em lote)
  ├─ 4. Deleta o item no DynamoDB (DeleteItem)
  ├─ 5. Invalida o cookie prolink_session
  └─ 6. Retorna { ok: true }
```

### Camadas afetadas

| Camada | Arquivo | Ação |
|--------|---------|------|
| API route | `apps/api/app/api/session/route.ts` | MODIFY — adicionar handler `DELETE` |
| AWS client | `apps/api/lib/aws/s3.ts` | MODIFY — adicionar helper de delete em lote por prefixo (`DeleteObjectsCommand`) |
| AWS client | `apps/api/lib/aws/dynamodb.ts` | MODIFY — adicionar helper `deleteDraft(sessionId)` |
| Docs | `docs/arquitetura.md` | MODIFY — mover da linha "futuro" para a tabela de rotas de API |

## Critérios de aceite

- [x] `DELETE /api/session` retorna 403 sem `prolink_session` válido (reaproveita `requireSession()`)
- [x] `DELETE /api/session` retorna 409 se `status === 'enviado'` (não apaga dados já protocolados)
- [x] Em sessão `rascunho`: apaga todos os objetos S3 sob `{sessionId}/`, apaga o item DynamoDB, invalida o cookie, retorna `{ ok: true }`
- [x] Teste manual: criar sessão + rascunho + upload de um arquivo, chamar `DELETE /api/session`, confirmar via console/CLI que o item DynamoDB e os objetos S3 não existem mais
- [x] `npm run lint` e `npm run build` passando

## Notas

- Reaproveita 100% da infraestrutura de auth/sessão da Spec 008 (`requireSession`, cookies) — não introduz nenhum mecanismo novo de autenticação.
- O código de status HTTP para "já enviado" é `409 Conflict` (estado do recurso incompatível com a operação pedida), não `403`, para diferenciar de "sem permissão".
