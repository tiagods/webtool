---
id: "003"
title: "Lógica e Validação (Fase 3)"
status: done
created: 2026-04-12
author: "Claude"
batch_size: "large"
depends_on: ["002"]
description: "Cross-field validations (Zod), block navigation if invalid."
---

# Lógica e Validação do Formulário (Fase 3)

## Contexto

A Fase 2 concluiu o layout estático de modo excelente. Na Fase 3, nós vamos conectar todas essas visões estáticas em um formulário reativo central liderado pelo `react-hook-form` em conjunto com a biblioteca de validação `zod`.

## Objetivo

Dar vida à UI: capturar os dados do usuário com tipagem forte, realizar o cruzamento de validações do negócio e bloquear o avanço das etapas caso as informações faltem ou sejam inválidas. A validação cross-field e os schemas Zod vão residir não na pasta `apps/web` diretamente, mas no nosso pacote base `@prolink/shared`, garantindo que esses mesmos moldes possam ser usados no futuro pelo nosso Service Worker da Lambda (Fase 6).

## Design 

### Arquivos criados/modificados

| Camada | Arquivo | Ação |
|--------|---------|------|
| Shared | `packages/shared/src/schemas/abertura.ts` | CREATE |
| Shared | `packages/shared/src/index.ts` | MODIFY |
| Motor | `apps/web/app/abertura/StepperEngine.tsx` | MODIFY |
| Forms | `apps/web/components/forms/StepDadosEmpresa.tsx` | MODIFY |
| Forms | `apps/web/components/forms/StepEndereco.tsx`... | MODIFY |
| UI | `apps/web/components/ui/form.tsx` (shadcn) | CREATE (via CLI) |

### Schemas Zod Compartilhados

Será criado o pacote de domínios `abertura.ts`. Conforme visto na `ficha-abertura.md`, este esquema será multi-camada:

- `stepDadosEmpresa`: Enum de `ltda | slu`, validação min 3 chars.
- `stepEndereco`: Regex e formatação de CEP.
- `socioSchema`: E-mail, PIS e refines para participação anterior de CNPJ.
- `stepSociedade`: Validação super-estrita da totalização das quotas para fechar 100%.

Este schema global será exportado e fundido em `AberturaFormSchema`.

### Orquestrador (`StepperEngine`)

Adotaremos o `useForm` aliado ao `zodResolver(AberturaFormSchema)`.
Englobaremos o `CurrentView` renderizado com a HOC `<FormProvider {...methods}>`.

O botão "Avançar" precisará sofrer uma alteração drástica:
1. Ele identificará o `currentStep`.
2. Rodará o método `.trigger(['nome_dos_campos_do_passo_atual'])` fornecido pelo RHF.
3. Se falhar na validação, o avanço do route `?step=` é cancelado e as mensagens de erro em vermelho pulam passivamente nos inputs não preenchidos.
4. O `isSlu` migrará do `useState` para `useWatch({ name: 'tipoConstituicao' })`.

### Adoção do Shadcn Form Component

Para facilitar a integração, adotaremos o componente oficial `<Form>` do shadcn/ui.
Os `StepX.tsx` passarão a implementar a estrutura de `<FormField>`, `<FormItem>`, `<FormControl>` e `<FormMessage>` para tratar as exibições ricas de validação dos campos.

## Critérios de aceite

- [x] Instalação formal do componente Form: `npx shadcn@latest add form`
- [x] Criação dos Schemas Zod oficiais no `packages/shared` refletindo totalmente a documentação do projeto, mantendo compilação estrita (`strict: true`).
- [x] Conexão do `StepperEngine` com o `FormProvider` preservando dados entre navegações reais de aba.
- [x] O usuário é **BLOQUEADO** de navegar para o passo seguinte apertando "Avançar" se o formulário apresentar erros na aba respectiva.
- [x] Acessos indevidos simulados (ex: acessar a URL `localhost:3000/abertura?step=4` diretamente sem o passo 1 preenchido) redirecionarão o usuário para a última etapa válida ou etapa 1.

## Notas Adicionais

- O campo de arrays para **Sócios** no `StepSocios` exigirá que implementemos o hook nativo `useFieldArray` para renderização sob demanda e manipulações.
