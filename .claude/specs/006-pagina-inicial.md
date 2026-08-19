---
id: "006"
title: "Página Inicial — Seleção de Ficha"
status: done
created: 2026-07-01
author: "Claude"
batch_size: "small"
depends_on: ["001"]
---

# Página Inicial — Seleção de Ficha

## Contexto

> Hoje `/` (`apps/web/app/page.tsx`) apenas redireciona direto para `/abertura` — não existe uma tela de entrada. O `docs/inicio.md` descreve uma Página Inicial com dois cards (Abertura / Alteração) que ainda não foi implementada.
>
> Essa página é também o ponto certo para o gate do Termo de Ciência LGPD (Spec 007): o termo precisa bloquear o acesso **antes de qualquer um dos dois fluxos começar**, e hoje só existe o fluxo de Abertura — colocar o gate apenas no layout de `/abertura` não cobriria uma futura `/alteracao`. Por isso esta spec foi reordenada para vir antes da 007.

## Objetivo

> Substituir o redirect atual por uma Página Inicial estática com os dois cards de seleção (Abertura / Alteração), conforme `docs/inicio.md` e o design no Paper (página `4-0`), servindo como ponto de entrada único da aplicação.

## Fora de escopo

- Fluxo de Alteração completo (rota `/alteracao` com os 5 passos) — spec futura, ver `docs/ficha-alteracao.md`
- Termo de Ciência LGPD e qualquer lógica de gate/aceite — Spec 007
- Criação de sessão ou chamadas a API — esta página é puramente navegacional

## Design

### Camadas afetadas

| Camada | Arquivo | Ação |
|--------|---------|------|
| Page | `apps/web/app/page.tsx` | MODIFY — remove o redirect, renderiza a seleção |
| Component | `apps/web/components/SelecaoFichaCard.tsx` | CREATE |

### Conteúdo

Dois cards lado a lado (desktop) / empilhados (mobile):

| Card | Ícone | Descrição | Rodapé | CTA |
|---|---|---|---|---|
| Abertura | casa | "Registre uma nova empresa com todo o amparo jurídico e contábil. Preencha os dados em 6 passos simples." | `6 passos · ~10 min` | **Iniciar Abertura →** (primário) → `/abertura` |
| Alteração | lápis | "Solicite alterações nos dados cadastrais de uma empresa já existente. Rápido, seguro e sem burocracia." | `Processo simplificado` | **Iniciar Alteração →** (secundário, outline) — marcado como **Em breve** (desabilitado) |

> O card de Alteração fica desabilitado com badge "Em breve" nesta spec — a rota `/alteracao` ainda não existe (fora de escopo). Reativar o CTA faz parte da spec futura do fluxo de Alteração.

## Critérios de aceite

- [x] `/` renderiza a Página Inicial com os dois cards em vez de redirecionar direto para `/abertura`
- [x] Card "Abertura" navega para `/abertura` ao clicar no CTA
- [x] Card "Alteração" exibido com badge "Em breve" e CTA desabilitado
- [x] Layout responsivo: cards lado a lado no desktop (`md:grid-cols-2`), empilhados no mobile
- [x] Visual fiel ao Paper Design (página `4-0`)
- [x] Lint passando (`npm run lint`)
- [x] Build sem erros (`npm run build`)

## Notas

- Fluxo completo de Alteração é tratado em spec futura (ver `docs/ficha-alteracao.md`)
- Esta página passa a ser o ponto de gate do Termo de Ciência LGPD (Spec 007), que depende desta spec
