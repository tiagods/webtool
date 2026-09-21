import { z } from 'zod';
import { TIPO_CONSTITUICAO, ESTADO_CIVIL_ALTERACAO } from '../constants/enums';

// --- Passo 1: Identificação ---
// Decisão Spec 012: sem busca automática de CNPJ — o usuário preenche manualmente os
// dados cadastrais atuais da empresa (endereço atual modelado como grupo estruturado,
// sem IPTU, que é exclusivo do endereço NOVO em Q03).
export const enderecoAtualSchema = z.object({
  logradouro: z.string().min(2, 'Logradouro inválido'),
  bairro: z.string().min(2, 'Bairro inválido'),
  municipio: z.string().min(2, 'Município inválido'),
  estado: z.string().length(2, 'Estado (UF) inválido'),
  cep: z.string().regex(/^\d{5}-\d{3}$/, 'CEP inválido'),
});

export const stepIdentificacaoObjectSchema = z.object({
  cnpj: z.string().regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, 'CNPJ inválido'),
  razaoSocial: z.string().min(3, 'Informe a razão social'),
  nomeFantasia: z.string().optional(),
  tipoConstituicao: z.enum(TIPO_CONSTITUICAO, { required_error: 'Informe o tipo de constituição' }),
  enderecoAtual: enderecoAtualSchema,
  situacao: z.enum(['ativa', 'inapta', 'baixada'], { required_error: 'Informe a situação cadastral' }),
});

// Apenas empresas ATIVA podem prosseguir (regra do doc) — exportado separado do objeto
// base para preservar a possibilidade de uso do objeto sem o refine se necessário.
export const stepIdentificacaoSchema = stepIdentificacaoObjectSchema.refine(
  (data) => data.situacao === 'ativa',
  { message: 'Apenas empresas com situação ATIVA podem prosseguir com a alteração.', path: ['situacao'] },
);

// --- Passo 2: Tipo de Alteração ---
export const quadroAlteracao = z.enum([
  'nome_empresarial', // Q01
  'objeto_social', // Q02
  'endereco', // Q03
  'quadro_societario', // Q04
  'capital_social', // Q05
  'redistribuicao_capital', // Q06
  'natureza_juridica', // Q07
  'administracao', // Q08
  'outras_alteracoes', // Q09
]);
export type QuadroAlteracao = z.infer<typeof quadroAlteracao>;

export const stepTipoAlteracaoSchema = z.object({
  quadros: z.array(quadroAlteracao).min(1, 'Selecione pelo menos um quadro'),
});

// --- Passo 3: Novos Dados (um schema por quadro, Q01-Q09) ---

// Q01 — Razão Social
export const q01NomeEmpresarialSchema = z.object({
  nomeEmpresarial1: z.string().min(3, 'Informe a 1ª opção (mín. 3 caracteres)'),
  nomeEmpresarial2: z.string().min(3, 'Informe a 2ª opção (mín. 3 caracteres)'),
  nomeEmpresarial3: z.string().min(3, 'Informe a 3ª opção (mín. 3 caracteres)'),
});

// Q02 — Objeto Social
export const q02ObjetoSocialSchema = z.object({
  novoObjetoSocial: z.string().min(20, 'Descreva a atividade com mais detalhes (mín. 20 caracteres)'),
});

// Q03 — Mudança de Endereço da Sede
export const q03EnderecoSchema = z.object({
  logradouro: z.string().min(2, 'Logradouro inválido'),
  bairro: z.string().min(2, 'Bairro inválido'),
  municipio: z.string().min(2, 'Município inválido'),
  estado: z.string().length(2, 'Estado (UF) inválido'),
  cep: z.string().regex(/^\d{5}-\d{3}$/, 'CEP inválido'),
  iptu: z.string().min(1, 'Informe o nº do IPTU'),
});

// Q04 — Quadro Societário
export const estadoCivilAlteracao = z.enum(ESTADO_CIVIL_ALTERACAO);

// Campos comuns a cedente e cessionário. Exportado SEM refine/extend aplicado diretamente
// aqui (lição Spec 008/010: ZodEffects de .refine() não expõe .extend()) — o refine de
// cnpjAnterior é aplicado no nível do array em q04QuadroSocietarioSchema, não por membro.
export const membroBaseObjectSchema = z.object({
  nomeCompleto: z.string().min(3, 'Informe o nome completo'),
  naturalidade: z.string().min(2, 'Informe a naturalidade'),
  estadoNaturalidade: z.string().length(2, 'Estado (UF) inválido'),
  profissao: z.string().min(2, 'Informe a profissão'),
  rg: z.string().min(1, 'Informe o RG'),
  digitoRg: z.string().min(1, 'Informe o dígito do RG').max(2),
  orgaoExpedidor: z.string().min(2, 'Informe o órgão expedidor'),
  estadoExpedidor: z.string().length(2, 'Estado (UF) inválido'),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF inválido'),
  dataExpedicaoRg: z.string().min(1, 'Informe a data de expedição do RG'),
  dataNascimento: z.string().min(1, 'Informe a data de nascimento'),
  pis: z.string().min(1, 'Informe o nº do PIS'),
  logradouro: z.string().min(2, 'Logradouro inválido'),
  numero: z.string().min(1, 'Informe o número'),
  bairro: z.string().min(2, 'Bairro inválido'),
  municipio: z.string().min(2, 'Município inválido'),
  estado: z.string().length(2, 'Estado (UF) inválido'),
  cep: z.string().regex(/^\d{5}-\d{3}$/, 'CEP inválido'),
  telefoneResidencial: z.string().optional(),
  telefoneComercial: z.string().optional(),
  ramal: z.string().optional(),
  celular: z.string().min(14, 'Celular incompleto'),
  email: z.string().email('E-mail inválido'),
  recados: z.string().optional(),
  nomeMae: z.string().min(3, 'Informe o nome da mãe'),
  nomePai: z.string().optional(),
  participacaoAnterior: z.enum(['sim', 'nao']),
  cnpjAnterior: z.string().optional(),
  percentualParticipacao: z.number().min(0.01, 'Min % é 0.01').max(100, 'Max % é 100'),
  valorParticipacao: z.number().positive('Informe o valor da participação'),
  estadoCivil: estadoCivilAlteracao,
});

export const cedenteSchema = membroBaseObjectSchema.extend({
  tipo: z.literal('cedente'),
});

export const cessionarioSchema = membroBaseObjectSchema.extend({
  tipo: z.literal('cessionario'),
  socioAdministrador: z.string().min(1, 'Informe se será sócio administrador'),
  proLabore: z.number().positive('Informe o valor do pró-labore'),
});

export const membroSchema = z.discriminatedUnion('tipo', [cedenteSchema, cessionarioSchema]);

export const q04QuadroSocietarioSchema = z
  .object({
    membros: z.array(membroSchema).min(1, 'Adicione ao menos um sócio (cedente ou cessionário)'),
  })
  .superRefine((data, ctx) => {
    data.membros.forEach((membro, idx) => {
      if (membro.participacaoAnterior === 'sim' && !membro.cnpjAnterior) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe o CNPJ da empresa anterior',
          path: ['membros', idx, 'cnpjAnterior'],
        });
      }
    });
  });

// Q05 — Alteração do Capital Social
export const q05CapitalSocialSchema = z
  .object({
    valorCapitalSocial: z.number().positive('Informe o valor do capital social'),
    tipoAlteracao: z.enum(['aumento', 'reducao'], { required_error: 'Informe o tipo de alteração' }),
    valorIntegralizacao: z.number().positive().optional(),
    especificarIntegralizacao: z.string().min(5).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.tipoAlteracao === 'aumento') {
      if (!data.valorIntegralizacao) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe o valor da integralização',
          path: ['valorIntegralizacao'],
        });
      }
      if (!data.especificarIntegralizacao) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Especifique a forma de integralização',
          path: ['especificarIntegralizacao'],
        });
      }
    }
  });

// Q06 — Redistribuição do Capital Social entre os Sócios
export const redistribuicaoSocioSchema = z.object({
  nomeSocio: z.string().min(3, 'Informe o nome do sócio'),
  percentual: z.number().min(0.01, 'Min % é 0.01').max(100, 'Max % é 100'),
  valor: z.number().positive('Informe o valor em R$'),
});

export const q06RedistribuicaoSchema = z.object({
  socios: z.array(redistribuicaoSocioSchema).min(1, 'Adicione ao menos um sócio'),
});

// Q07 — Alteração/Transformação da Natureza Jurídica
export const q07NaturezaJuridicaSchema = z
  .object({
    tipoTransformacao: z.enum(['ltda_para_simples', 'simples_para_ltda', 'outras'], {
      required_error: 'Informe o tipo de transformação',
    }),
    especificar: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.tipoTransformacao === 'outras' && !data.especificar) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Especifique a transformação',
        path: ['especificar'],
      });
    }
  });

// Q08 — Alteração da Administração da Sociedade
export const q08AdministracaoSchema = z.object({
  administradores: z.array(z.string().min(3, 'Informe o nome do administrador')).min(1, 'Informe ao menos um administrador'),
});

// Q09 — Outras Alterações
export const q09OutrasSchema = z.object({
  descricao: z.string().min(10, 'Descreva a alteração com mais detalhes'),
});

// --- Master Form Schema ---
// Exportado separado do .superRefine() abaixo para permitir alteracaoFormObjectSchema.partial()
// (rascunho salvo por quadro completo) — ZodEffects (retorno de superRefine) não expõe .partial().
export const alteracaoFormObjectSchema = z.object({
  identificacao: stepIdentificacaoSchema,
  quadros: z.array(quadroAlteracao).min(1, 'Selecione pelo menos um quadro'),
  q01: q01NomeEmpresarialSchema.optional(),
  q02: q02ObjetoSocialSchema.optional(),
  q03: q03EnderecoSchema.optional(),
  q04: q04QuadroSocietarioSchema.optional(),
  q05: q05CapitalSocialSchema.optional(),
  q06: q06RedistribuicaoSchema.optional(),
  q07: q07NaturezaJuridicaSchema.optional(),
  q08: q08AdministracaoSchema.optional(),
  q09: q09OutrasSchema.optional(),
  aceite: z.boolean().refine((val) => val === true, {
    message: 'Você precisa aceitar os termos de consentimento',
  }),
});

const quadroParaChave: Record<QuadroAlteracao, 'q01' | 'q02' | 'q03' | 'q04' | 'q05' | 'q06' | 'q07' | 'q08' | 'q09'> = {
  nome_empresarial: 'q01',
  objeto_social: 'q02',
  endereco: 'q03',
  quadro_societario: 'q04',
  capital_social: 'q05',
  redistribuicao_capital: 'q06',
  natureza_juridica: 'q07',
  administracao: 'q08',
  outras_alteracoes: 'q09',
};

export const alteracaoFormSchema = alteracaoFormObjectSchema.superRefine((data, ctx) => {
  data.quadros.forEach((codigo) => {
    const chave = quadroParaChave[codigo];
    if (!data[chave]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Preencha os dados do quadro selecionado (${codigo})`,
        path: [chave],
      });
    }
  });
});

export type AlteracaoFormValues = z.infer<typeof alteracaoFormSchema>;

// Usado por POST /api/alteracao/draft (rascunho salvo por quadro completo): aceita objeto
// parcial, mas rejeita chaves de topo desconhecidas (.strict() antes de .partial() preserva
// a política). `aceite` é reescrito sem o .refine(=== true) pela mesma razão da Spec 010:
// .partial() só torna a CHAVE opcional, não relaxa o refine quando o valor `false` está presente.
export const alteracaoFormDraftSchema = alteracaoFormObjectSchema
  .strict()
  .partial()
  .extend({ aceite: z.boolean().optional() });
