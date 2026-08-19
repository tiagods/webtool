---
id: "005"
title: "Upload de Documentos (Fase 5)"
status: done
created: 2026-06-30
author: "Claude"
batch_size: "medium"
depends_on: ["004"]
---

# Upload de Documentos (Fase 5)

## Contexto

> A Fase 4 concluiu as máscaras de input e auto-preenchimento ViaCEP. O formulário já captura dados da empresa, endereço, sócios e dados da sociedade com validação Zod completa. Porém, o **Passo 4 (SLU) / Passo 5 (Ltda) — Documentos** ainda não existe. Este passo é crítico: cada sócio precisa enviar RG, CPF, comprovante de residência, IRPF, título de eleitor e documentos condicionais (certidão de casamento, registro profissional, contrato de locação). Os arquivos devem ir diretamente para o S3 via presigned URLs, sem passar pelo servidor Next.js.

## Objetivo

> Implementar o StepDocumentos completo com:
> 1. Interface de upload por tabs (uma tab por sócio + tab "Imóvel")
> 2. Componente `UploadField` com drag & drop, preview e estados (pendente/enviado/erro)
> 3. API route `/api/upload-url` que gera presigned URLs do S3
> 4. Lista de documentos dinâmica baseada nas respostas do formulário (documentos condicionais)
> 5. Salvamento dos links S3 no draft atual
> 6. Apos clicar no botao concluir e enviar, quero que crie um modal customizado e mais agradavel ao inves de apenas o javascript puro.

## Fora de escopo

- Backend DynamoDB / persistência real (Spec 008)
- Geração de PDF (Spec 008)
- Envio de email via SES (Spec 008)
- SQS / Lambda worker (Spec 008)
- Senha Gov.BR (instrução visual, sem upload)
- Validação de conteúdo dos arquivos (apenas tipo e tamanho)

## Design

### Documentos por sócio

| Documento | Obrigatoriedade | Condição |
|---|---|---|
| RG (frente e verso) | Obrigatório | Sempre |
| CPF | Obrigatório | Sempre |
| Comprovante de Residência | Obrigatório | Sempre |
| Certidão de Casamento | Condicional | `estadoCivil` começa com `casado_` |
| Registro Profissional | Condicional | Profissão que exige conselho (CRM, OAB, CRECI, CORE) |
| Recibo IRPF (últimos 2 anos) | Obrigatório | Sempre |
| Título de Eleitor | Obrigatório | Sempre |

### Documentos do imóvel (tab "Imóvel")

| Documento | Obrigatoriedade | Condição |
|---|---|---|
| IPTU do Imóvel | Obrigatório | Sempre |
| Contrato de Locação | Condicional | `imovelAlugado === 'sim'` |

### Fluxo de upload

```
1. Usuário arrasta/clique no UploadField
2. Browser → POST /api/upload-url { campo: "socio_0_rg_frente", contentType: "application/pdf" }
3. Servidor gera presigned PUT URL (validade: 5 min)
4. Browser faz PUT direto no S3 com o arquivo
5. Browser salva a chave S3 no estado do form
6. UploadField muda para estado "enviado" com link para remover
```

### Camadas afetadas

| Camada | Arquivo | Ação |
|--------|---------|------|
| Component | `apps/web/components/UploadField.tsx` | CREATE |
| Component | `apps/web/components/forms/StepDocumentos.tsx` | CREATE |
| API | `apps/web/app/api/upload-url/route.ts` | CREATE |
| Lib | `apps/web/lib/aws/s3.ts` | CREATE |
| Forms | `apps/web/app/abertura/StepperEngine.tsx` | MODIFY |
| Shared | `packages/shared/src/schemas/documentos.ts` | CREATE |
| Shared | `packages/shared/src/index.ts` | MODIFY |

### Contratos / Interfaces

```ts
// packages/shared/src/schemas/documentos.ts

interface DocumentoUpload {
  chave: string           // e.g. "socio_0_rg_frente"
  label: string           // e.g. "RG - Frente"
  s3Key?: string          // preenchido após upload
  status: 'pending' | 'uploading' | 'uploaded' | 'error'
}

interface DocumentosSocio {
  rgFrente: DocumentoUpload
  rgVerso: DocumentoUpload
  cpf: DocumentoUpload
  comprovanteResidencia: DocumentoUpload
  irpf2024: DocumentoUpload
  irpf2025: DocumentoUpload
  tituloEleitor: DocumentoUpload
  certificaoCasamento?: DocumentoUpload   // condicional
  registroProfissional?: DocumentoUpload  // condicional
}

interface DocumentosImovel {
  iptu: DocumentoUpload
  contratoLocacao?: DocumentoUpload       // condicional
}

// Schema Zod para validar que docs obrigatórios foram enviados
const documentoSchema = z.object({
  socios: z.array(z.object({
    rgFrente: z.string().url(),
    rgVerso: z.string().url(),
    cpf: z.string().url(),
    comprovanteResidencia: z.string().url(),
    irpf2024: z.string().url(),
    irpf2025: z.string().url(),
    tituloEleitor: z.string().url(),
  })),
  imovel: z.object({
    iptu: z.string().url(),
  }),
})
```

### API Route — `/api/upload-url`

```ts
// POST /api/upload-url
// Body: { campo: string, contentType: string }
// Response: { url: string, key: string }

// Valida:
// - contentType em [application/pdf, image/jpeg, image/png]
// - tamanho maximo declarado <= 10MB
// - gera key: {sessionId}/documentos/{campo}.{ext}
// - retorna presigned URL PUT (5 min validade)
```

### Componente `UploadField`

- Drag & drop zone com label do documento
- Estados visuais: vazio → arrastando → upload → sucesso (check verde) → erro (alerta vermelho)
- Botão "X" para remover e reenviar
- Feedback de progresso (spinner durante upload)
- Limite: PDF, JPG, PNG até 10MB

### Lógica condicional de documentos

O `StepDocumentos` recebe os dados do formulário (sócios, endereço) e monta a lista dinâmica:

```ts
function getDocumentosParaSocio(socio: Socio, index: number): DocumentoUpload[] {
  const docs = [rgFrente, rgVerso, cpf, comprovanteResidencia, irpf2024, irpf2025, tituloEleitor]
  if (socio.estadoCivil.startsWith('casado_')) docs.push(certificaoCasamento)
  if (profissaoExigeConselho(socio.profissao)) docs.push(registroProfissional)
  return docs
}

function profissaoExigeConselho(profissao: string): boolean {
  // verifica se contem: medico, advogado, corretor, engenheiro, etc.
}
```

## Critérios de aceite

- [x] `UploadField.tsx` criado com drag & drop, preview, estados visuais
- [x] `StepDocumentos.tsx` criado com tabs por sócio + tab "Imóvel"
- [x] `/api/upload-url` gera presigned URL válida para S3
- [x] Upload direto browser → S3 funciona (PDF, JPG, PNG até 10MB)
- [x] Lista de documentos é dinâmica (condicional por estado civil e profissão)
- [x] Chaves S3 são salvas no estado do form (pronto para persistência na Fase 6)
- [x] Schema Zod `documentos.ts` criado em `@prolink/shared`
- [x] StepDocumentos integrado ao StepperEngine (aparece no fluxo correto: passo 5 na Ltda, passo 4 na SLU)
- [x] Lint passando (`npm run lint`)
- [x] Build sem erros (`npm run build`)

## Notas

- O bucket S3 é privado — acesso apenas via presigned URLs
- A chave S3 segue o padrão `{sessionId}/documentos/{campo}.{ext}`
- Senha Gov.BR é instrução visual — exibir como info card, não como campo de upload
- A persistência real das chaves S3 no DynamoDB fica para a Spec 008
- Nesta fase, as chaves S3 ficam no estado do form (memória) — o draft já é salvo pelo StepperEngine
