# Prolink Contábil — Formulários Web

Documentação do sistema de formulários digitais para abertura e alteração de empresas.

## Visão Geral

O sistema substitui as fichas cadastrais em Word por um fluxo web multi-step, orientado a dados, com upload de documentos e envio direto para a equipe contábil.

## Formulários disponíveis

| Formulário | Arquivo | Descrição |
|---|---|---|
| Abertura de Empresa (Ltda) | [ficha-abertura.md](./ficha-abertura.md) | Abertura com 2+ sócios |
| Abertura Unipessoal (SLU) | [ficha-abertura.md](./ficha-abertura.md) | Abertura com sócio único |
| Alteração Contratual | [ficha-alteracao.md](./ficha-alteracao.md) | Alterações societárias e contratuais |

## Design System

| Item | Valor |
|---|---|
| Cor primária (navy) | `#05354C` |
| Cor de ação (azul) | `#0099FF` |
| Cor complementar (sky) | `#6CBCDA` |
| Sucesso | `#16a34a` |
| Erro | `#DC2626` |
| Borda | `#E5E5E8` |
| Superfície | `#F9F9F9` |
| Fonte heading | Inter Display, Inter, sans-serif |
| Fonte UI | Inter, sans-serif |

## Stack Técnica

- **Framework**: Next.js 14+ (App Router)
- **Formulários**: React Hook Form + Zod
- **UI**: shadcn/ui
- **Máscaras**: react-imask (CPF, CNPJ, CEP, telefone)
- **Upload**: UploadThing ou S3 presigned URLs
- **E-mail**: Resend
- **PDF**: react-pdf ou pdfmake
- **CEP**: ViaCEP API (busca automática)

## Protótipo

Design criado no Paper com 5 artboards:
- Passo 1 — Dados da Empresa
- Passo 2 — Endereço
- Passo 3 — Sócios
- Passo 4 — Documentos
- Passo 5 — Revisão e Envio

## Estrutura de pastas sugerida

```
src/
  app/
    abertura/
      page.tsx          # Roteamento do multi-step
      layout.tsx
    alteracao/
      page.tsx
  components/
    forms/
      StepDadosEmpresa.tsx
      StepEndereco.tsx
      StepSocios.tsx
      StepDocumentos.tsx
      StepRevisao.tsx
    ui/                 # shadcn/ui components
    Stepper.tsx
    UploadField.tsx
    RadioCard.tsx
  lib/
    schemas/            # Zod schemas por passo
    actions/            # Server actions (envio, PDF)
    viacep.ts           # Integração ViaCEP
```
