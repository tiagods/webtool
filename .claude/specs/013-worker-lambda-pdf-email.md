---
id: "013"
title: "Worker Lambda — Geração de PDF e E-mail (Fase 7)"
status: draft
created: 2026-07-07
author: "Claude"
batch_size: "medium"
depends_on: ["008"]
---

# Worker Lambda — Geração de PDF e E-mail (Fase 7)

> **Rascunho inicial — a aprofundar em discussão antes de aprovar.** `docs/arquitetura.md` já descreve o fluxo pretendido; esta spec ainda precisa de decisões técnicas (deploy do Lambda, formato do PDF) antes de virar `approved`.

## Contexto

Desde a Spec 008 (`done`), `POST /api/submit` já publica uma mensagem no SQS (`{ sessionId, protocolo, tipo }`) ao final do envio de uma ficha — mas **não existe consumidor**. `apps/worker` está documentado em `docs/arquitetura.md` e no `CLAUDE.md` raiz ("[Planned Phase 7]"), mas o diretório não existe no repositório. Hoje, toda mensagem publicada na fila fica parada indefinidamente: nenhum PDF é gerado, nenhum e-mail é enviado para `contato@prolinkcontabil.com.br` — ou seja, **o fluxo de ponta a ponta ainda não notifica ninguém quando uma ficha é enviada**, o que é o objetivo final de todo o sistema.

A Spec 008 também deixou um critério de segurança explicitamente pendente até esta spec existir: o worker deveria zerar `payload`/`documentosKeys` no DynamoDB (se ainda presentes) ao consumir a mensagem, como defesa em profundidade LGPD.

## Objetivo

A definir em conjunto com o usuário. Pontos que a discussão precisa fechar antes de detalhar o Design:

- Deploy do Lambda: `apps/worker` como pacote separado buildado e deployado manualmente (`sam`/`serverless`/CLI direta), ou via alguma IaC (Terraform/CDK)? Hoje não existe nenhuma infraestrutura como código no repositório — este seria o primeiro componente AWS gerenciado fora de scripts CLI (`infra/local/init.sh`).
- Geração de PDF: `docs/arquitetura.md` e `docs/README.md` citam `react-pdf`; confirmar se segue essa escolha e qual o layout do documento (mesmo layout da ficha Word original em `fichas/`, ou um resumo mais enxuto?).
- Runtime do Lambda (Node.js versão, memória/timeout — geração de PDF pode ser custosa) e trigger (SQS event source mapping, batch size).
- Tratamento de erro/retry: mensagens que falham (ex.: erro ao gerar PDF) vão para uma Dead Letter Queue? Reprocessamento manual ou automático?
- Escopo do e-mail: só notifica a equipe interna (`contato@prolinkcontabil.com.br`, conforme documentado), ou também confirma para o cliente que preencheu a ficha? `docs/arquitetura.md` hoje descreve só o e-mail interno via SNS→SES.

## Fora de escopo (provisório)

- Qualquer mudança em `apps/api`/`apps/web` — o contrato da mensagem SQS já está definido e estável desde a Spec 008 (`{ sessionId, protocolo, tipo }`).
- Consumo de mensagens da Ficha de Alteração Contratual (Spec 012, também em discussão) — a integrar depois que ambas as specs estiverem definidas.

## Design

> Não preenchido — aguardando decisões da seção Objetivo.

## Critérios de aceite

- [ ] Lambda worker zera `payload` e `documentosKeys` no DynamoDB (se ainda presentes) ao consumir a mensagem SQS — item pendente explícito herdado da Spec 008
- [ ] (Demais critérios não preenchidos — a spec só deve sair de `draft` depois da sessão de discussão com o usuário)

## Notas

- Fluxo de referência completo (já documentado, não implementado): `docs/arquitetura.md`, seção "Lambda (worker SQS)".
- Dependências de pacote já antecipadas em `docs/arquitetura.md` (`@aws-sdk/client-ses`, `@react-pdf/renderer`) — não confirmadas nesta sessão, só documentadas como intenção original.
