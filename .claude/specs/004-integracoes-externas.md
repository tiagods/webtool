---
id: "004"
title: "Integrações Externas (Máscaras + ViaCEP)"
status: done
created: 2026-06-30
author: "Claude"
batch_size: "medium"
depends_on: ["003"]
---

# Integrações Externas — Máscaras e ViaCEP (Fase 4)

## Contexto

A Fase 3 entregou validação completa com Zod e React Hook Form. Porém, os campos do formulário ainda não possuem máscaras de entrada (CEP, CPF, CNPJ, PIS, telefone, moeda) e o preenchimento de endereço é manual. Isso prejudica a UX e aumenta erros de digitação.

## Objetivo

Adicionar duas melhorias de experiência ao formulário:
1. **Máscaras de input** em todos os campos que exigem formato fixo
2. **Auto-preenchimento de endereço** via API ViaCEP ao digitar o CEP (Passo 2 e endereço de registro dos sócios no Passo 3)

## Fora de escopo

- Upload de documentos (Spec 005)
- Backend / persistência (Spec 008)
- Validações cross-field adicionais além do que já existe na Spec 003
- Internacionalização de moeda (apenas R$ BRL)

## Design

### Camadas afetadas

| Camada | Arquivo | Ação |
|--------|---------|------|
| Lib | `apps/web/lib/masks.ts` | CREATE |
| Lib | `apps/web/lib/viacep.ts` | CREATE |
| Forms | `apps/web/components/forms/StepEndereco.tsx` | MODIFY |
| Forms | `apps/web/components/forms/StepSocios.tsx` | MODIFY |
| Forms | `apps/web/components/forms/StepSociedade.tsx` | MODIFY |

### Máscaras (`lib/masks.ts`)

Usar `react-imask` (IMaskInput) para todas as máscaras:

```ts
// Constantes reutilizáveis de máscara
export const CEP_MASK = '00000-000'
export const CPF_MASK = '000.000.000-00'
export const CNPJ_MASK = '00.000.000/0000-00'
export const PIS_MASK = '000.00000.00-0'
export const PHONE_MASK = [{ mask: '(00) 00000-0000' }, { mask: '(00) 0000-0000' }]
export const CURRENCY_MASK = { mask: 'R$ num', blocks: { num: { mask: Number, scale: 2, ... } } }
```

Aplicar nos campos:
- `cep`, `cepRegistro` → CEP_MASK
- `cpf` → CPF_MASK
- `cnpjParticipacao` → CNPJ_MASK
- `pis` → PIS_MASK
- `telefoneCelular`, `telefoneFixo` → PHONE_MASK
- `proLabore`, `capitalSocial` → CURRENCY_MASK

### Hook ViaCEP (`lib/viacep.ts`)

```ts
export function useViaCEP(cep: string) {
  // Debounce de 500ms após CEP completo (8 dígitos)
  // GET https://viacep.com.br/ws/{cep}/json/
  // Retorna: { logradouro, bairro, localidade, uf, erro? }
  // Estados: idle | loading | success | error
}
```

Campos auto-preenchidos (e desabilitados enquanto vêm da API):
- `logradouro`, `bairro`, `municipio`, `estado`

Campos que o usuário preenche manualmente mesmo após ViaCEP:
- `numero`, `complemento`, `iptu`, `imovelAlugado`

Tratar caso `{ "erro": true }` (CEP não encontrado) com mensagem amigável.

### Aplicação nos Steps

- **StepEndereco**: usar `useViaCEP` no campo `cep`; aplicar IMaskInput em CEP
- **StepSocios**: aplicar IMaskInput em CPF, PIS, telefones, pró-labore; usar `useViaCEP` no campo `cepRegistro`
- **StepSociedade**: aplicar IMaskInput em `capitalSocial`

## Critérios de aceite

- [x] Instalar `react-imask` e `@types/react-imask` (se necessário)
- [x] `lib/masks.ts` criado com todas as constantes de máscara
- [x] `lib/viacep.ts` criado com hook `useViaCEP` (debounce, loading, error)
- [x] CEP em `StepEndereco` auto-preenche logradouro, bairro, município, UF
- [x] CEP inválido exibe mensagem de erro sem travar o formulário
- [x] Campos auto-preenchidos ficam desabilitados (mas editáveis pelo usuário se quiser corrigir)
- [x] CPF, PIS, telefones e pró-labore com máscaras em `StepSocios`
- [x] Capital social com máscara de moeda em `StepSociedade`
- [x] `cepRegistro` dos sócios também usa `useViaCEP`
- [x] Lint passando (`npm run lint`)
- [x] Build sem erros (`npm run build`)

## Notas

- `react-imask` integra bem com RHF via `Controller` — usar `IMaskController` ou wrapper customizado
- ViaCEP é gratuito, sem autenticação, CORS liberado para browser
- Campos auto-preenchidos devem continuar editáveis para casos de CEP com endereço desatualizado
- Valor de moeda deve ser salvo no form como `number` (não string formatada)
