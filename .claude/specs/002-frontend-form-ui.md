---
id: "002"
title: "Interface das Telas do Formulário (Fase 2)"
status: done
created: 2026-04-12
author: "Claude"
batch_size: "medium"
depends_on: ["001"]
---

# Interface das Telas do Formulário (Fase 2)

## Contexto

> O ambiente do projeto já está devidamente configurado com banco de dependências de UI, Tailwind, e Next.js em roteamento raiz. Agora necessitamos modelar todo o aspecto visual (UI) do formulário digital multi-etapas de "Abertura de Empresa" com base nos cartões e guias criadas e revisadas do ambiente Paper Design. 

## Objetivo

> Construir e compor as telas e componentes visuais de forma estática (apenas UI + responsividade). **Não** faremos ligações de estados com `react-hook-form` / `zod` ou upload para AWS nessa fase – o foco único é assegurar a excelência responsiva e *pixel-perfect* exigida pela documentação `docs/design-system.md` e a fidelidade ao Paper Design.

## Fora de escopo
- Lógica real de formulário (React Hook Form), Schemas Zod e submissões (Fase 3).
- Hooks viacep e regras condicionais elaboradas (Fase 4).
- Persistência e Upload / File Drop Zone real (Fase 5/6). 

## Design

### Arquivos criados/modificados

| Camada | Arquivo | Ação |
|--------|---------|------|
| Layout | `apps/web/app/abertura/layout.tsx` | CREATE |
| Page | `apps/web/app/abertura/page.tsx` | CREATE |
| UI | `apps/web/components/Stepper.tsx` | CREATE |
| UI | `apps/web/components/RadioCard.tsx` | CREATE |
| UI | `apps/web/components/RadioChip.tsx` | CREATE |
| Forms | `apps/web/components/forms/StepDadosEmpresa.tsx` | CREATE |
| Forms | `apps/web/components/forms/StepEndereco.tsx` | CREATE |
| Forms | `apps/web/components/forms/StepSocios.tsx` | CREATE |
| Forms | `apps/web/components/forms/StepSociedade.tsx` | CREATE |
| Forms | `apps/web/components/forms/StepDocumentos.tsx` | CREATE |
| Forms | `apps/web/components/forms/StepRevisao.tsx` | CREATE |

### Componentes de UI Dinâmicos (Comuns)

**Stepper**: Responsivo alinhado com as regras de design. Esferas coloridas no modo mobile, títulos expansivos no desktop.

**RadioCard e RadioChip**: Componentes Tailwind clicáveis criados no Paper, que emulam os behaviors do nativo `<input type="radio">` utilizando as diretrizes de visualização customizada.

### Formulários Visuais (Steps)

Todas as Views (`StepDadosEmpresa.tsx` até `StepRevisao.tsx`) usam os patterns configurados globalmente, focando primeiramente em `<form>` sintético e renderizações `.map` no lugar de duplicação. 

## Critérios de aceite

- [x] Todos componentes renderizando na rota `/abertura` no Next.js
- [x] O `Stepper` avança etapas localmente com os furos controlados pelo root state (apenas como simulador de UI). 
- [x] Acessibilidade e tags mínimas HTML5 preservadas (`<fieldset>`, `<label>`, `<input>`).
- [x] Visualização das 6 etapas estáticas está 100% equivalente ao desenhado no Paper MCP Server.
- [x] Comportamento mobile verificado e grid breaks (`grid-cols-1 md:grid-cols-2`) validados.

## Notas
- Devemos manter atenção especial à exclusividade de abas e componentes para a opção "Sociedade Limitada".
