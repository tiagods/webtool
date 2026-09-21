import { z } from 'zod';
import { TIPO_CONSTITUICAO, ESTADO_CIVIL_BASE } from '../constants/enums';

// --- Passo 1: Dados da Empresa ---
export const stepDadosEmpresaSchema = z.object({
  tipoConstituicao: z.enum(TIPO_CONSTITUICAO, { required_error: 'Informe o tipo de constituição' }),
  nomeEmpresarial1: z.string().min(3, 'Informe a 1ª opção (mín. 3 caracteres)'),
  nomeEmpresarial2: z.string().min(3, 'Informe a 2ª opção (mín. 3 caracteres)'),
  nomeEmpresarial3: z.string().min(3, 'Informe a 3ª opção (mín. 3 caracteres)'),
  nomeFantasia: z.string().optional(),
  atividade: z.string().min(20, 'Descreva a atividade com mais detalhes (mín. 20 caracteres)'),
});

// --- Endereço de Correspondência (sub-objeto reutilizável) ---
export const enderecoCorrespondenciaSchema = z.object({
  cep: z.string().regex(/^\d{5}-\d{3}$/, 'CEP inválido'),
  logradouro: z.string().min(2, 'Logradouro inválido'),
  numero: z.string().min(1, 'Informe o número'),
  complemento: z.string().optional(),
  bairro: z.string().min(2, 'Bairro inválido'),
  municipio: z.string().min(2, 'Município inválido'),
  estado: z.string().length(2, 'Estado (UF) inválido'),
});

// --- Passo 2: Endereço da Sede ---
export const stepEnderecoSchema = z.object({
  cep: z.string().regex(/^\d{5}-\d{3}$/, 'CEP inválido'),
  logradouro: z.string().min(2, 'Logradouro inválido'),
  numero: z.string().min(1, 'Informe o número'),
  complemento: z.string().optional(),
  bairro: z.string().min(2, 'Bairro inválido'),
  municipio: z.string().min(2, 'Município inválido'),
  estado: z.string().length(2, 'Estado (UF) inválido'),
  iptu: z.string().min(1, 'Informe o nº do IPTU'),
  imovelAlugado: z.enum(['sim', 'nao']),
  correspondencia: z.enum(['sim', 'nao']).optional(),
  enderecoCorrespondencia: enderecoCorrespondenciaSchema.optional(),
  locadorTipo: z.enum(['pf', 'pj']).optional(),
  tipoFuncionamento: z.enum(['comercial', 'industrial', 'servicos', 'outros']).optional(),
});

// --- Passo 3: Sócios ---
export const socioSchema = z.object({
  nome: z.string().min(3, 'Informe o nome completo'),
  pis: z.string().regex(/^\d{3}\.\d{5}\.\d{2}-\d$/, 'PIS inválido'),
  profissao: z.string().min(2, 'Informe a profissão'),
  proLabore: z.number().min(1518, 'O pró-labore mínimo é de 1 salário mínimo (R$ 1.518,00)'), // 2026 — atualizado anualmente
  telefoneCelular: z.string().min(14, 'Telefone celular incompleto'),
  telefoneFixo: z.string().optional(),
  email: z.string().email('E-mail inválido'),
  estadoCivil: z.enum(ESTADO_CIVIL_BASE),
  teveParticipacaoSocietaria: z.boolean(),
  cnpjParticipacao: z.string().optional(),
});

// Como cada step pode ter requisitos baseados no pai, vamos agrupar:
export const stepSociosSchema = z.object({
  socios: z.array(socioSchema).min(1, 'Adicione pelo menos 1 sócio'),
  // A validação de "mínimo 2 se for ltda" precisa ser um refine no master schema
});

// --- Passo 4: Sociedade ---
// Parte referente aos sócios (as cotas de cada um + se administra)
export const quotaSocioSchema = z.object({
  percentual: z.number().min(0.01, 'Min % é 0.01').max(100, 'Max % é 100'),
  isAdministrador: z.boolean(),
});

export const stepSociedadeSchema = z.object({
  capitalSocial: z.number().min(0.01, 'Informe um valor para o Capital Social'),
  quotas: z.array(quotaSocioSchema),
  tipoAdministracao: z.enum(['isoladamente', 'conjunta', 'outras']),
  banco: z.string().min(2, 'Informe o banco para a conta PJ'),
});

// --- Master Form Schema ---
// Engloba todos os dados para que o React Hook Form segure o State inteiro.
// Exportado separado do .superRefine() abaixo para permitir aberturaFormObjectSchema.partial()
// (rascunhos salvos a cada step) — ZodEffects (retorno de superRefine) não expõe .partial().
export const aberturaFormObjectSchema = z.object({
  // Step 1
  dadosEmpresa: stepDadosEmpresaSchema,
  // Step 2
  endereco: stepEnderecoSchema,
  // Step 3
  dadosSocios: stepSociosSchema,
  // Step 4 (só faz sentido se a empresa for LTDA)
  sociedade: stepSociedadeSchema.optional(),
  // Step 5 — documentos da empresa (não dos sócios)
  senhaGovBr: z.string().optional(),
  documentosAceitos: z.boolean().refine(val => val === true, {
    message: "Você precisa aceitar os termos de consentimento"
  }),
});

export const aberturaFormSchema = aberturaFormObjectSchema.superRefine((data, ctx) => {
  // Regras condicionais do Passo 2 — Endereço
  if (data.endereco) {
    // Se imóvel alugado, locadorTipo é obrigatório
    if (data.endereco.imovelAlugado === 'sim' && !data.endereco.locadorTipo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe o tipo do locador (PF ou PJ)',
        path: ['endereco', 'locadorTipo'],
      });
    }
    // Se correspondência é diferente da sede, enderecoCorrespondencia é obrigatório
    if (data.endereco.correspondencia === 'nao') {
      if (!data.endereco.enderecoCorrespondencia) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe o endereço de correspondência',
          path: ['endereco', 'enderecoCorrespondencia'],
        });
      }
    }
  }

  // Regra de Sócios Mínimos dependendo do tipo
  if (data.dadosEmpresa.tipoConstituicao === 'ltda' && data.dadosSocios.socios.length < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Sociedade Limitada (Ltda) requer pelo menos 2 sócios.',
      path: ['dadosSocios', 'socios'],
    });
  }

  // Regra de CNPJ para Participação Societária Anterior
  data.dadosSocios.socios.forEach((socio, idx) => {
    if (socio.teveParticipacaoSocietaria && !socio.cnpjParticipacao) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe o CNPJ da empresa anterior',
        path: ['dadosSocios', 'socios', idx, 'cnpjParticipacao'],
      });
    }
  });

  // Regra Exclusiva para a aba Sociedade
  if (data.dadosEmpresa.tipoConstituicao === 'ltda') {
    if (!data.sociedade) {
       ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Preencha os dados da sociedade.',
        path: ['sociedade'],
      });
      return;
    }
    
    // Validar percentual se somar 100%
    const totalQuotas = data.sociedade.quotas.reduce((acc, curr) => acc + (curr.percentual || 0), 0);
    // Margem de erro p/ float
    if (Math.abs(totalQuotas - 100) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A soma das quotas deve fechar exatamente 100%.',
        path: ['sociedade', 'quotas'],
      });
    }

    // Pelo menos 1 adm
    const temAdmin = data.sociedade.quotas.some((q) => q.isAdministrador);
    if (!temAdmin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A sociedade deve conter ao menos 1 administrador.',
        path: ['sociedade', 'quotas'],
      });
    }

    // A quantidade de itens de quotas deve ser igual a de sócios
    if (data.sociedade.quotas.length !== data.dadosSocios.socios.length) {
       ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Cada sócio precisa de uma quota definida.',
        path: ['sociedade', 'quotas'],
      });
    }
  }
});

export type AberturaFormValues = z.infer<typeof aberturaFormSchema>;

// Usado por POST /api/draft (rascunho salvo a cada step): aceita objeto parcial,
// mas rejeita chaves de topo desconhecidas (.strict() antes de .partial() preserva a política).
// `documentosAceitos` é reescrito sem o .refine(=== true): um rascunho salvo antes do
// último passo sempre carrega `false` nesse campo, e .partial() só torna a CHAVE opcional
// (pode estar ausente) — não relaxa o refine quando o valor `false` está presente.
export const aberturaFormDraftSchema = aberturaFormObjectSchema
  .strict()
  .partial()
  .extend({ documentosAceitos: z.boolean().optional() });
