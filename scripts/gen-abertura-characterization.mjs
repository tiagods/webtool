// Suíte de caracterização do validador da Ficha de Abertura.
//
// Roda um conjunto de payloads representativos contra os schemas Zod reais
// (`aberturaFormSchema` para o formulário completo, `aberturaFormDraftSchema`
// para o rascunho parcial) e grava o veredito esperado (aceito/rejeitado +
// caminhos das issues). O validador Go de `apps/backend/domain/validation`
// tem que reproduzir exatamente esse veredito — ver `abertura_test.go`.
//
// Uso:
//   node scripts/gen-abertura-characterization.mjs
//
// Gera (e sobrescreve):
//   apps/backend/domain/validation/testdata/casos_abertura.json     (entradas)
//   apps/backend/domain/validation/testdata/veredito_esperado.json  (saídas Zod)

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  aberturaFormSchema,
  aberturaFormDraftSchema,
} from '../packages/shared/src/schemas/abertura.ts';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const dirTestdata = join(raiz, 'apps/backend/domain/validation/testdata');

// --- Baselines válidos (mutados por caso via structuredClone) ---------------

const socioValido1 = {
  nome: 'Joao da Silva Santos',
  pis: '123.45678.90-1',
  cpf: '123.456.789-00',
  rg: '12.345.678-9 SSP/SP',
  nacionalidade: 'brasileira',
  profissao: 'engenheiro',
  proLabore: 1412,
  telefoneCelular: '(11) 98765-4321',
  telefoneFixo: '',
  email: 'joao@example.com',
  estadoCivil: 'solteiro',
  nomeMae: 'Maria da Silva Santos',
  nomePai: '',
  cepRegistro: '01310-100',
  logradouroRegistro: 'Avenida Paulista',
  numeroRegistro: '1000',
  complementoRegistro: '',
  bairroRegistro: 'Bela Vista',
  registroConselho: '',
  teveParticipacaoSocietaria: false,
  cnpjParticipacao: '',
};

const socioValido2 = {
  nome: 'Ana Pereira Costa',
  pis: '987.65432.10-9',
  cpf: '987.654.321-00',
  rg: '98.765.432-1 SSP/SP',
  nacionalidade: 'brasileira',
  profissao: 'advogada',
  proLabore: 2000,
  telefoneCelular: '(11) 91234-5678',
  telefoneFixo: '',
  email: 'ana@example.com',
  estadoCivil: 'casado_comunhao_parcial',
  nomeMae: 'Clara Pereira Costa',
  nomePai: '',
  cepRegistro: '04567-000',
  logradouroRegistro: 'Rua das Flores',
  numeroRegistro: '50',
  complementoRegistro: '',
  bairroRegistro: 'Jardim Paulista',
  registroConselho: '',
  teveParticipacaoSocietaria: false,
  cnpjParticipacao: '',
};

const enderecoValido = {
  cep: '01310-100',
  logradouro: 'Avenida Paulista',
  numero: '1578',
  complemento: 'Sala 5',
  bairro: 'Bela Vista',
  municipio: 'Sao Paulo',
  estado: 'SP',
  iptu: '123456789',
  imovelAlugado: false,
};

const dadosEmpresaLtda = {
  tipoConstituicao: 'ltda',
  nomeEmpresarial1: 'Prolink Servicos Ltda',
  nomeEmpresarial2: 'Prolink Consultoria Ltda',
  nomeEmpresarial3: 'Prolink Solucoes Ltda',
  nomeFantasia: 'Prolink',
  atividade: 'Prestacao de servicos de consultoria empresarial e contabil',
};

const dadosEmpresaSlu = {
  ...structuredClone(dadosEmpresaLtda),
  tipoConstituicao: 'slu',
};

const sociedadeValida = {
  capitalSocial: 10000,
  quotas: [
    { percentual: 50, isAdministrador: true },
    { percentual: 50, isAdministrador: false },
  ],
  tipoAdministracao: 'isoladamente',
  banco: 'Banco do Brasil',
};

// formLtdaValido monta o payload completo de uma Ltda com 2 sócios.
function formLtdaValido() {
  return {
    dadosEmpresa: structuredClone(dadosEmpresaLtda),
    endereco: structuredClone(enderecoValido),
    dadosSocios: { socios: [structuredClone(socioValido1), structuredClone(socioValido2)] },
    sociedade: structuredClone(sociedadeValida),
    senhaGovBr: '',
    documentosAceitos: true,
  };
}

// formSluValido monta o payload completo de uma SLU com 1 sócio (sem sociedade).
function formSluValido() {
  return {
    dadosEmpresa: structuredClone(dadosEmpresaSlu),
    endereco: structuredClone(enderecoValido),
    dadosSocios: { socios: [structuredClone(socioValido1)] },
    senhaGovBr: '',
    documentosAceitos: true,
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
  { nome: 'full_ltda_valido', modo: 'full', input: formLtdaValido() },
  { nome: 'full_slu_valido', modo: 'full', input: formSluValido() },
  {
    nome: 'full_ltda_um_socio',
    modo: 'full',
    input: muta(formLtdaValido(), (f) => {
      f.dadosSocios.socios = [f.dadosSocios.socios[0]];
      f.sociedade.quotas = [{ percentual: 100, isAdministrador: true }];
    }),
  },
  {
    nome: 'full_ltda_quotas_soma_9999_dentro_margem',
    modo: 'full',
    input: muta(formLtdaValido(), (f) => {
      f.sociedade.quotas = [
        { percentual: 49.99, isAdministrador: true },
        { percentual: 50.0, isAdministrador: false },
      ];
    }),
  },
  {
    nome: 'full_ltda_quotas_soma_10002_fora_margem',
    modo: 'full',
    input: muta(formLtdaValido(), (f) => {
      f.sociedade.quotas = [
        { percentual: 50.01, isAdministrador: true },
        { percentual: 50.01, isAdministrador: false },
      ];
    }),
  },
  {
    nome: 'full_ltda_sem_administrador',
    modo: 'full',
    input: muta(formLtdaValido(), (f) => {
      f.sociedade.quotas.forEach((q) => (q.isAdministrador = false));
    }),
  },
  {
    nome: 'full_ltda_quotas_quantidade_diferente_de_socios',
    modo: 'full',
    input: muta(formLtdaValido(), (f) => {
      f.sociedade.quotas = [{ percentual: 100, isAdministrador: true }];
    }),
  },
  {
    nome: 'full_ltda_sem_sociedade',
    modo: 'full',
    input: muta(formLtdaValido(), (f) => {
      delete f.sociedade;
    }),
  },
  {
    nome: 'full_socio_participacao_societaria_sem_cnpj',
    modo: 'full',
    input: muta(formSluValido(), (f) => {
      f.dadosSocios.socios[0].teveParticipacaoSocietaria = true;
      f.dadosSocios.socios[0].cnpjParticipacao = '';
    }),
  },
  {
    nome: 'full_documentos_nao_aceitos',
    modo: 'full',
    input: muta(formLtdaValido(), (f) => {
      f.documentosAceitos = false;
    }),
  },
  {
    nome: 'full_cep_sede_invalido',
    modo: 'full',
    input: muta(formLtdaValido(), (f) => {
      f.endereco.cep = '1310-100';
    }),
  },
  {
    nome: 'full_cpf_socio_invalido',
    modo: 'full',
    input: muta(formLtdaValido(), (f) => {
      f.dadosSocios.socios[0].cpf = '12345678900';
    }),
  },
  {
    nome: 'full_pis_socio_invalido',
    modo: 'full',
    input: muta(formLtdaValido(), (f) => {
      f.dadosSocios.socios[1].pis = '12345678901';
    }),
  },
  {
    nome: 'full_email_socio_invalido',
    modo: 'full',
    input: muta(formLtdaValido(), (f) => {
      f.dadosSocios.socios[0].email = 'joao-sem-arroba';
    }),
  },
  {
    nome: 'full_atividade_curta',
    modo: 'full',
    input: muta(formLtdaValido(), (f) => {
      f.dadosEmpresa.atividade = 'Consultoria';
    }),
  },
  {
    nome: 'full_prolabore_abaixo_minimo',
    modo: 'full',
    input: muta(formLtdaValido(), (f) => {
      f.dadosSocios.socios[0].proLabore = 1000;
    }),
  },
  {
    nome: 'full_estado_civil_invalido',
    modo: 'full',
    input: muta(formLtdaValido(), (f) => {
      f.dadosSocios.socios[0].estadoCivil = 'namorando';
    }),
  },
  {
    nome: 'full_multiplos_erros_field_e_crossfield',
    modo: 'full',
    input: muta(formLtdaValido(), (f) => {
      f.endereco.cep = 'xxx';
      f.documentosAceitos = false;
      f.dadosSocios.socios = [f.dadosSocios.socios[0]];
    }),
  },
  {
    nome: 'full_tipo_constituicao_invalido',
    modo: 'full',
    input: muta(formLtdaValido(), (f) => {
      f.dadosEmpresa.tipoConstituicao = 'eireli';
    }),
  },
  {
    nome: 'full_dados_empresa_ausente',
    modo: 'full',
    input: muta(formLtdaValido(), (f) => {
      delete f.dadosEmpresa;
    }),
  },
  {
    nome: 'full_dados_socios_ausente',
    modo: 'full',
    input: muta(formSluValido(), (f) => {
      delete f.dadosSocios;
    }),
  },
  {
    nome: 'full_chave_topo_desconhecida_ignorada',
    modo: 'full',
    input: muta(formLtdaValido(), (f) => {
      f.campoExtra = 'ignorar';
    }),
  },

  // ---- rascunho parcial ----
  { nome: 'draft_vazio', modo: 'draft', input: {} },
  { nome: 'draft_so_dados_empresa', modo: 'draft', input: { dadosEmpresa: structuredClone(dadosEmpresaLtda) } },
  { nome: 'draft_documentos_aceitos_false', modo: 'draft', input: { documentosAceitos: false } },
  { nome: 'draft_documentos_aceitos_true', modo: 'draft', input: { documentosAceitos: true } },
  { nome: 'draft_chave_topo_desconhecida', modo: 'draft', input: { foo: 'bar' } },
  {
    nome: 'draft_step_incompleto',
    modo: 'draft',
    input: { dadosEmpresa: { tipoConstituicao: 'ltda' } },
  },
  {
    nome: 'draft_parcial_valido_empresa_e_endereco',
    modo: 'draft',
    input: {
      dadosEmpresa: structuredClone(dadosEmpresaLtda),
      endereco: structuredClone(enderecoValido),
    },
  },
  {
    nome: 'draft_socios_parcial',
    modo: 'draft',
    input: { dadosSocios: { socios: [structuredClone(socioValido1)] } },
  },
  {
    nome: 'draft_sociedade_incompleta',
    modo: 'draft',
    input: { sociedade: { capitalSocial: 0 } },
  },
];

// --- Execução ------------------------------------------------------------

const schemaPorModo = {
  full: aberturaFormSchema,
  draft: aberturaFormDraftSchema,
};

// caminhoIssue serializa o path da issue Zod (['dadosSocios','socios',0,'cpf'])
// como "dadosSocios/socios/0/cpf". Path vazio (issue de raiz) vira "(root)".
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
  join(dirTestdata, 'casos_abertura.json'),
  JSON.stringify(casos, null, 2) + '\n',
);
writeFileSync(
  join(dirTestdata, 'veredito_esperado.json'),
  JSON.stringify(veredito, null, 2) + '\n',
);

const rejeitados = veredito.filter((v) => !v.aceito).length;
console.log(
  `Gerados ${casos.length} casos (${veredito.length - rejeitados} aceitos, ${rejeitados} rejeitados) em ${dirTestdata}`,
);
