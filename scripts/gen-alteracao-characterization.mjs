// Suíte de caracterização do validador da Ficha de Alteração Contratual.
//
// Roda um conjunto de payloads representativos contra os schemas Zod reais
// (`alteracaoFormSchema` para o formulário completo, `alteracaoFormDraftSchema`
// para o rascunho parcial) e grava o veredito esperado (aceito/rejeitado +
// caminhos das issues). O validador Go de `apps/backend/domain/validation`
// tem que reproduzir exatamente esse veredito — ver `alteracao_test.go`.
//
// Uso:
//   node scripts/gen-alteracao-characterization.mjs
//
// Gera (e sobrescreve):
//   apps/backend/domain/validation/testdata/casos_alteracao.json            (entradas)
//   apps/backend/domain/validation/testdata/veredito_alteracao_esperado.json (saídas Zod)

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  alteracaoFormSchema,
  alteracaoFormDraftSchema,
} from '../packages/shared/src/schemas/alteracao.ts';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const dirTestdata = join(raiz, 'apps/backend/domain/validation/testdata');

// --- Baselines válidos (mutados por caso via structuredClone) ---------------

const enderecoAtualValido = {
  logradouro: 'Avenida Paulista',
  bairro: 'Bela Vista',
  municipio: 'Sao Paulo',
  estado: 'SP',
  cep: '01310-100',
};

const identificacaoValida = {
  cnpj: '12.345.678/0001-90',
  razaoSocial: 'Prolink Servicos Ltda',
  nomeFantasia: 'Prolink',
  tipoConstituicao: 'ltda',
  enderecoAtual: structuredClone(enderecoAtualValido),
  situacao: 'ativa',
};

// membro base (comum a cedente e cessionário)
const membroBaseValido = {
  nomeCompleto: 'Joao da Silva Santos',
  naturalidade: 'Sao Paulo',
  estadoNaturalidade: 'SP',
  profissao: 'engenheiro',
  rg: '12345678',
  digitoRg: '9',
  orgaoExpedidor: 'SSP',
  estadoExpedidor: 'SP',
  cpf: '123.456.789-00',
  dataExpedicaoRg: '2010-01-15',
  dataNascimento: '1985-06-20',
  pis: '12345678901',
  logradouro: 'Rua das Flores',
  numero: '100',
  bairro: 'Centro',
  municipio: 'Sao Paulo',
  estado: 'SP',
  cep: '01310-100',
  celular: '(11) 98765-4321',
  email: 'joao@example.com',
  nomeMae: 'Maria da Silva Santos',
  participacaoAnterior: 'nao',
  percentualParticipacao: 50,
  valorParticipacao: 5000,
  estadoCivil: 'solteiro',
};

const cedenteValido = {
  ...structuredClone(membroBaseValido),
  tipo: 'cedente',
};

const cessionarioValido = {
  ...structuredClone(membroBaseValido),
  tipo: 'cessionario',
  nomeCompleto: 'Ana Pereira Costa',
  cpf: '987.654.321-00',
  email: 'ana@example.com',
  nomeMae: 'Clara Pereira Costa',
  estadoCivil: 'casado_comunhao_parcial',
  socioAdministrador: 'sim',
  proLabore: 2000,
};

// blocos válidos por quadro (Q01-Q09)
const q01Valido = {
  nomeEmpresarial1: 'Prolink Servicos Ltda',
  nomeEmpresarial2: 'Prolink Consultoria Ltda',
  nomeEmpresarial3: 'Prolink Solucoes Ltda',
};
const q02Valido = {
  novoObjetoSocial: 'Prestacao de servicos de consultoria empresarial e contabil',
};
const q03Valido = {
  logradouro: 'Rua Nova',
  bairro: 'Jardim Paulista',
  municipio: 'Sao Paulo',
  estado: 'SP',
  cep: '04567-000',
  iptu: '987654321',
};
const q04Valido = {
  membros: [structuredClone(cedenteValido), structuredClone(cessionarioValido)],
};
const q05Valido = { valorCapitalSocial: 10000, tipoAlteracao: 'reducao' };
const q05AumentoValido = {
  valorCapitalSocial: 20000,
  tipoAlteracao: 'aumento',
  valorIntegralizacao: 10000,
  especificarIntegralizacao: 'em moeda corrente nacional',
};
const q06Valido = {
  socios: [
    { nomeSocio: 'Joao da Silva Santos', percentual: 50, valor: 5000 },
    { nomeSocio: 'Ana Pereira Costa', percentual: 50, valor: 5000 },
  ],
};
const q07Valido = { tipoTransformacao: 'ltda_para_simples' };
const q07OutrasValido = { tipoTransformacao: 'outras', especificar: 'transformacao em cooperativa' };
const q08Valido = { administradores: ['Joao da Silva Santos', 'Ana Pereira Costa'] };
const q09Valido = { descricao: 'Alteracao diversa descrita com detalhes suficientes' };

// formValido monta o payload completo mínimo: identificação ativa + 1 quadro.
function formValido() {
  return {
    identificacao: structuredClone(identificacaoValida),
    quadros: ['objeto_social'],
    q02: structuredClone(q02Valido),
    aceite: true,
  };
}

// formTodosQuadros monta o payload com os 9 quadros selecionados e preenchidos.
function formTodosQuadros() {
  return {
    identificacao: structuredClone(identificacaoValida),
    quadros: [
      'nome_empresarial',
      'objeto_social',
      'endereco',
      'quadro_societario',
      'capital_social',
      'redistribuicao_capital',
      'natureza_juridica',
      'administracao',
      'outras_alteracoes',
    ],
    q01: structuredClone(q01Valido),
    q02: structuredClone(q02Valido),
    q03: structuredClone(q03Valido),
    q04: structuredClone(q04Valido),
    q05: structuredClone(q05AumentoValido),
    q06: structuredClone(q06Valido),
    q07: structuredClone(q07OutrasValido),
    q08: structuredClone(q08Valido),
    q09: structuredClone(q09Valido),
    aceite: true,
  };
}

// muta aplica fn ao clone de base e devolve o resultado.
function muta(base, fn) {
  const clone = structuredClone(base);
  fn(clone);
  return clone;
}

// --- Casos -----------------------------------------------------------------

const casos = [
  // ---- formulário completo ----
  { nome: 'full_valido_q02', modo: 'full', input: formValido() },
  { nome: 'full_valido_todos_quadros', modo: 'full', input: formTodosQuadros() },
  {
    nome: 'full_identificacao_inapta',
    modo: 'full',
    input: muta(formValido(), (f) => {
      f.identificacao.situacao = 'inapta';
    }),
  },
  {
    nome: 'full_identificacao_baixada',
    modo: 'full',
    input: muta(formValido(), (f) => {
      f.identificacao.situacao = 'baixada';
    }),
  },
  {
    nome: 'full_identificacao_situacao_invalida',
    modo: 'full',
    input: muta(formValido(), (f) => {
      f.identificacao.situacao = 'suspensa';
    }),
  },
  {
    nome: 'full_identificacao_ausente',
    modo: 'full',
    input: muta(formValido(), (f) => {
      delete f.identificacao;
    }),
  },
  {
    nome: 'full_cnpj_invalido',
    modo: 'full',
    input: muta(formValido(), (f) => {
      f.identificacao.cnpj = '12345678000190';
    }),
  },
  {
    nome: 'full_endereco_atual_cep_invalido',
    modo: 'full',
    input: muta(formValido(), (f) => {
      f.identificacao.enderecoAtual.cep = '1310-100';
    }),
  },
  {
    nome: 'full_quadros_vazio',
    modo: 'full',
    input: muta(formValido(), (f) => {
      f.quadros = [];
    }),
  },
  {
    nome: 'full_quadro_selecionado_sem_bloco',
    modo: 'full',
    input: muta(formValido(), (f) => {
      f.quadros = ['nome_empresarial'];
      delete f.q02;
    }),
  },
  {
    nome: 'full_dois_quadros_um_sem_bloco',
    modo: 'full',
    input: muta(formValido(), (f) => {
      f.quadros = ['objeto_social', 'endereco'];
    }),
  },
  {
    nome: 'full_objeto_social_curto',
    modo: 'full',
    input: muta(formValido(), (f) => {
      f.q02.novoObjetoSocial = 'Consultoria';
    }),
  },
  {
    nome: 'full_q04_cedente_ok',
    modo: 'full',
    input: muta(formValido(), (f) => {
      f.quadros = ['quadro_societario'];
      delete f.q02;
      f.q04 = { membros: [structuredClone(cedenteValido)] };
    }),
  },
  {
    nome: 'full_q04_cessionario_sem_prolabore',
    modo: 'full',
    input: muta(formValido(), (f) => {
      f.quadros = ['quadro_societario'];
      delete f.q02;
      const c = structuredClone(cessionarioValido);
      delete c.proLabore;
      f.q04 = { membros: [c] };
    }),
  },
  {
    nome: 'full_q04_tipo_invalido',
    modo: 'full',
    input: muta(formValido(), (f) => {
      f.quadros = ['quadro_societario'];
      delete f.q02;
      const c = structuredClone(cedenteValido);
      c.tipo = 'terceiro';
      f.q04 = { membros: [c] };
    }),
  },
  {
    nome: 'full_q04_participacao_anterior_sem_cnpj',
    modo: 'full',
    input: muta(formValido(), (f) => {
      f.quadros = ['quadro_societario'];
      delete f.q02;
      const c = structuredClone(cedenteValido);
      c.participacaoAnterior = 'sim';
      f.q04 = { membros: [c] };
    }),
  },
  {
    nome: 'full_q05_aumento_sem_integralizacao',
    modo: 'full',
    input: muta(formValido(), (f) => {
      f.quadros = ['capital_social'];
      delete f.q02;
      f.q05 = { valorCapitalSocial: 10000, tipoAlteracao: 'aumento' };
    }),
  },
  {
    nome: 'full_q05_reducao_ok',
    modo: 'full',
    input: muta(formValido(), (f) => {
      f.quadros = ['capital_social'];
      delete f.q02;
      f.q05 = structuredClone(q05Valido);
    }),
  },
  {
    nome: 'full_q07_outras_sem_especificar',
    modo: 'full',
    input: muta(formValido(), (f) => {
      f.quadros = ['natureza_juridica'];
      delete f.q02;
      f.q07 = { tipoTransformacao: 'outras' };
    }),
  },
  {
    nome: 'full_aceite_false',
    modo: 'full',
    input: muta(formValido(), (f) => {
      f.aceite = false;
    }),
  },
  {
    nome: 'full_aceite_ausente',
    modo: 'full',
    input: muta(formValido(), (f) => {
      delete f.aceite;
    }),
  },
  {
    nome: 'full_multiplos_erros_field_e_refine',
    modo: 'full',
    input: muta(formValido(), (f) => {
      f.identificacao.situacao = 'inapta';
      f.aceite = false;
      f.quadros = ['objeto_social'];
      delete f.q02;
    }),
  },
  {
    nome: 'full_chave_topo_desconhecida_ignorada',
    modo: 'full',
    input: muta(formValido(), (f) => {
      f.campoExtra = 'ignorar';
    }),
  },

  // ---- rascunho parcial ----
  { nome: 'draft_vazio', modo: 'draft', input: {} },
  { nome: 'draft_so_identificacao', modo: 'draft', input: { identificacao: structuredClone(identificacaoValida) } },
  {
    nome: 'draft_identificacao_inapta',
    modo: 'draft',
    input: { identificacao: muta(identificacaoValida, (i) => { i.situacao = 'inapta'; }) },
  },
  { nome: 'draft_chave_topo_desconhecida', modo: 'draft', input: { foo: 'bar' } },
  { nome: 'draft_aceite_false', modo: 'draft', input: { aceite: false } },
  { nome: 'draft_quadros_selecionados_sem_blocos', modo: 'draft', input: { quadros: ['objeto_social', 'endereco'] } },
  { nome: 'draft_q04_parcial', modo: 'draft', input: { q04: { membros: [structuredClone(cedenteValido)] } } },
  {
    nome: 'draft_q05_aumento_incompleto',
    modo: 'draft',
    input: { q05: { valorCapitalSocial: 10000, tipoAlteracao: 'aumento' } },
  },
  {
    nome: 'draft_q07_outras_sem_especificar',
    modo: 'draft',
    input: { q07: { tipoTransformacao: 'outras' } },
  },
  {
    nome: 'draft_parcial_valido_identificacao_e_q02',
    modo: 'draft',
    input: {
      identificacao: structuredClone(identificacaoValida),
      quadros: ['objeto_social'],
      q02: structuredClone(q02Valido),
    },
  },
];

// --- Execução ------------------------------------------------------------

const schemaPorModo = {
  full: alteracaoFormSchema,
  draft: alteracaoFormDraftSchema,
};

// caminhoIssue serializa o path da issue Zod (['q04','membros',0,'cnpjAnterior'])
// como "q04/membros/0/cnpjAnterior". Path vazio (issue de raiz) vira "(root)".
function caminhoIssue(issue) {
  return issue.path.length === 0 ? '(root)' : issue.path.join('/');
}

const veredito = casos.map(({ nome, modo, input }) => {
  const schema = schemaPorModo[modo];
  const r = schema.safeParse(input);

  if (r.success) {
    return { nome, modo, aceito: true, issuePaths: [], issues: [] };
  }

  const issues = r.error.issues.map((i) => ({
    path: caminhoIssue(i),
    code: i.code,
    message: i.message,
  }));
  const issuePaths = [...new Set(issues.map((i) => i.path))].sort();

  return { nome, modo, aceito: false, issuePaths, issues };
});

mkdirSync(dirTestdata, { recursive: true });

writeFileSync(
  join(dirTestdata, 'casos_alteracao.json'),
  JSON.stringify(casos, null, 2) + '\n',
);
writeFileSync(
  join(dirTestdata, 'veredito_alteracao_esperado.json'),
  JSON.stringify(veredito, null, 2) + '\n',
);

const rejeitados = veredito.filter((v) => !v.aceito).length;
console.log(
  `Gerados ${casos.length} casos (${veredito.length - rejeitados} aceitos, ${rejeitados} rejeitados) em ${dirTestdata}`,
);
