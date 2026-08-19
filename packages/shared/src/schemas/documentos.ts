import { z } from 'zod';

export type DocumentoStatus = 'pending' | 'uploading' | 'uploaded' | 'error';

export interface DocumentoUpload {
  chave: string;
  label: string;
  s3Key?: string;
  status: DocumentoStatus;
}

export interface DocumentosSocio {
  rgFrente: DocumentoUpload;
  rgVerso: DocumentoUpload;
  cpf: DocumentoUpload;
  comprovanteResidencia: DocumentoUpload;
  irpf2024: DocumentoUpload;
  irpf2025: DocumentoUpload;
  tituloEleitor: DocumentoUpload;
  certidaoCasamento?: DocumentoUpload;
  registroProfissional?: DocumentoUpload;
}

export interface DocumentosImovel {
  iptu: DocumentoUpload;
  contratoLocacao?: DocumentoUpload;
}

const documentoUploadSchema = z.object({
  s3Key: z.string().min(1),
});

export const documentosSocioSchema = z.object({
  rgFrente: documentoUploadSchema,
  rgVerso: documentoUploadSchema,
  cpf: documentoUploadSchema,
  comprovanteResidencia: documentoUploadSchema,
  irpf2024: documentoUploadSchema,
  irpf2025: documentoUploadSchema,
  tituloEleitor: documentoUploadSchema,
});

export const documentosImovelSchema = z.object({
  iptu: documentoUploadSchema,
});

export const documentosFormSchema = z.object({
  socios: z.array(documentosSocioSchema),
  imovel: documentosImovelSchema,
});
