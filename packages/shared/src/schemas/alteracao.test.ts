import { describe, it, expect } from 'vitest';
import { enderecoAtualSchema, stepIdentificacaoObjectSchema, stepIdentificacaoSchema, stepTipoAlteracaoSchema, quadroAlteracao, q01NomeEmpresarialSchema, q02ObjetoSocialSchema, q03EnderecoSchema, q04QuadroSocietarioSchema, q05CapitalSocialSchema, q06RedistribuicaoSchema, q07NaturezaJuridicaSchema, q08AdministracaoSchema, q09OutrasSchema, alteracaoFormSchema, alteracaoFormDraftSchema } from './alteracao';
import { estadoCivilAlteracao } from './alteracao';

describe('enderecoAtualSchema', () => {
  const v = { logradouro: 'Rua A', bairro: 'Centro', municipio: 'Sao Paulo', estado: 'SP', cep: '01001-000' };
  it('aceita valido', () => { expect(enderecoAtualSchema.parse(v)).toEqual(v); });
  it('rejeita CEP invalido', () => { expect(() => enderecoAtualSchema.parse({ ...v, cep: '12' })).toThrow(); });
});

describe('stepIdentificacaoObjectSchema', () => {
  const v = { cnpj: '12.345.678/0001-90', razaoSocial: 'Empresa Ltda', nomeFantasia: 'Fantasia', tipoConstituicao: 'ltda' as const, enderecoAtual: { logradouro: 'Rua A', bairro: 'Centro', municipio: 'SP', estado: 'SP', cep: '01001-000' }, situacao: 'ativa' as const };
  it('aceita valido', () => { expect(stepIdentificacaoObjectSchema.parse(v)).toEqual(v); });
  it('aceita nomeFantasia opcional', () => { const { nomeFantasia, ...s } = v; expect(stepIdentificacaoObjectSchema.parse(s)).not.toHaveProperty('nomeFantasia'); });
});

describe('stepIdentificacaoSchema (refine situacao)', () => {
  const v = { cnpj: '12.345.678/0001-90', razaoSocial: 'Empresa Ltda', nomeFantasia: 'F', tipoConstituicao: 'ltda' as const, enderecoAtual: { logradouro: 'Rua X', bairro: 'Centro', municipio: 'SP', estado: 'SP', cep: '01001-000' }, situacao: 'ativa' as const };
  it('aceita ativa', () => { expect(stepIdentificacaoSchema.parse(v)).toBeTruthy(); });
  it('rejeita inapta', () => { expect(() => stepIdentificacaoSchema.parse({ ...v, situacao: 'inapta' })).toThrow(); });
  it('rejeita baixada', () => { expect(() => stepIdentificacaoSchema.parse({ ...v, situacao: 'baixada' })).toThrow(); });
});

describe('quadroAlteracao', () => {
  it('aceita todos os 9 valores', () => { for (const q of ['nome_empresarial','objeto_social','endereco','quadro_societario','capital_social','redistribuicao_capital','natureza_juridica','administracao','outras_alteracoes'] as const) { expect(quadroAlteracao.parse(q)).toBe(q); } });
});

describe('estadoCivilAlteracao', () => {
  it('aceita todos os 8 valores', () => { for (const e of ['solteiro','casado_comunhao_parcial','casado_comunhao_universal','casado_separacao_bens','casado_separacao_obrigatoria','separado_judicialmente','divorciado','viuvo'] as const) { expect(estadoCivilAlteracao.parse(e)).toBe(e); } });
describe('q01NomeEmpresarialSchema', () => {
  it('aceita valido', () => { expect(q01NomeEmpresarialSchema.parse({ nomeEmpresarial1: 'Nova Ltda', nomeEmpresarial2: 'Nova 2 Ltda', nomeEmpresarial3: 'Nova 3 Ltda' })).toBeTruthy(); });
  it('rejeita nome curto', () => { expect(() => q01NomeEmpresarialSchema.parse({ nomeEmpresarial1: 'AB', nomeEmpresarial2: 'CD', nomeEmpresarial3: 'EF' })).toThrow(); });
});

describe('q02ObjetoSocialSchema', () => {
  it('aceita valido', () => { expect(q02ObjetoSocialSchema.parse({ novoObjetoSocial: 'descricao com mais de 20 caracteres para teste' })).toBeTruthy(); });
  it('rejeita curto', () => { expect(() => q02ObjetoSocialSchema.parse({ novoObjetoSocial: 'curto' })).toThrow(); });
});

describe('q03EnderecoSchema', () => {
  const v = { logradouro: 'Rua Nova', bairro: 'Centro', municipio: 'SP', estado: 'SP', cep: '02001-000', iptu: '123' };
  it('aceita valido', () => { expect(q03EnderecoSchema.parse(v)).toEqual(v); });
  it('rejeita CEP', () => { expect(() => q03EnderecoSchema.parse({ ...v, cep: '12' })).toThrow(); });
});

describe('q07NaturezaJuridicaSchema', () => {
  it('aceita ltda_para_simples', () => { expect(q07NaturezaJuridicaSchema.parse({ tipoTransformacao: 'ltda_para_simples' })).toBeTruthy(); });
  it('rejeita outras sem especificar', () => { expect(() => q07NaturezaJuridicaSchema.parse({ tipoTransformacao: 'outras' })).toThrow(); });
  it('aceita outras com especificar', () => { expect(q07NaturezaJuridicaSchema.parse({ tipoTransformacao: 'outras', especificar: 'Teste' })).toBeTruthy(); });
});

describe('q08AdministracaoSchema', () => {
  it('aceita valido', () => { expect(q08AdministracaoSchema.parse({ administradores: ['Joao Silva'] })).toBeTruthy(); });
  it('rejeita vazio', () => { expect(() => q08AdministracaoSchema.parse({ administradores: [] })).toThrow(); });
  it('rejeita nome curto', () => { expect(() => q08AdministracaoSchema.parse({ administradores: ['AB'] })).toThrow(); });
});

describe('q09OutrasSchema', () => {
  it('aceita valido', () => { expect(q09OutrasSchema.parse({ descricao: 'descricao com mais de 10 caracteres' })).toBeTruthy(); });
  it('rejeita curto', () => { expect(() => q09OutrasSchema.parse({ descricao: 'curta' })).toThrow(); });
});

describe('alteracaoFormSchema', () => {
  const base = {
    identificacao: { cnpj: '12.345.678/0001-90', razaoSocial: 'Empresa Ltda', tipoConstituicao: 'ltda' as const, enderecoAtual: { logradouro: 'Rua X', bairro: 'Centro', municipio: 'SP', estado: 'SP', cep: '01001-000' }, situacao: 'ativa' as const },
    quadros: ['nome_empresarial'] as Array<'nome_empresarial'>,
    q01: { nomeEmpresarial1: 'Nova Ltda', nomeEmpresarial2: 'Nova 2 Ltda', nomeEmpresarial3: 'Nova 3 Ltda' },
    aceite: true,
  };
  it('aceita quadro preenchido', () => { expect(alteracaoFormSchema.parse(base)).toBeTruthy(); });
  it('rejeita quadro sem dados (refine)', () => { expect(() => alteracaoFormSchema.parse({ ...base, quadros: ['nome_empresarial','objeto_social'] })).toThrow(/Preencha os dados/); });
  it('rejeita aceite false', () => { expect(() => alteracaoFormSchema.parse({ ...base, aceite: false })).toThrow(/aceitar os termos/); });
describe('q04QuadroSocietarioSchema', () => {
  const base = { membros: [{ tipo: 'cedente' as const, nomeCompleto: 'Joao Silva', naturalidade: 'Brasileiro', estadoNaturalidade: 'SP', profissao: 'Emp', rg: 'RG 123', digitoRg: '1', orgaoExpedidor: 'SSP', estadoExpedidor: 'SP', cpf: '123.456.789-00', dataExpedicaoRg: '01/01/2020', dataNascimento: '01/01/1990', pis: '12345678901', logradouro: 'Rua A', numero: '100', bairro: 'Centro', municipio: 'SP', estado: 'SP', cep: '01001-000', celular: '(11) 99999-9999', email: 'a@b.com', nomeMae: 'Maria', participacaoAnterior: 'nao' as const, percentualParticipacao: 50, valorParticipacao: 10000, estadoCivil: 'solteiro' as const }] };
  it('aceita valido', () => { expect(q04QuadroSocietarioSchema.parse(base)).toBeTruthy(); });
  it('rejeita participacaoAnterior sim sem CNPJ', () => { expect(() => q04QuadroSocietarioSchema.parse({ membros: [{ ...base.membros[0], participacaoAnterior: 'sim' as const }] })).toThrow(); });
  it('aceita participacaoAnterior sim com CNPJ', () => { expect(q04QuadroSocietarioSchema.parse({ membros: [{ ...base.membros[0], participacaoAnterior: 'sim' as const, cnpjAnterior: '12.345.678/0001-90' }] })).toBeTruthy(); });
 });

describe('q05CapitalSocialSchema', () => {
  it('aceita aumento com integralizacao', () => { expect(q05CapitalSocialSchema.parse({ valorCapitalSocial: 50000, tipoAlteracao: 'aumento', valorIntegralizacao: 10000, especificarIntegralizacao: 'dinheiro' })).toBeTruthy(); });
  it('rejeita aumento sem valorIntegralizacao', () => { expect(() => q05CapitalSocialSchema.parse({ valorCapitalSocial: 50000, tipoAlteracao: 'aumento' })).toThrow(); });
  it('rejeita aumento sem especificarIntegralizacao', () => { expect(() => q05CapitalSocialSchema.parse({ valorCapitalSocial: 50000, tipoAlteracao: 'aumento', valorIntegralizacao: 10000 })).toThrow(); });
  it('aceita reducao', () => { expect(q05CapitalSocialSchema.parse({ valorCapitalSocial: 30000, tipoAlteracao: 'reducao' })).toBeTruthy(); });
});

describe('q06RedistribuicaoSchema', () => {
  it('aceita valido', () => { expect(q06RedistribuicaoSchema.parse({ socios: [{ nomeSocio: 'Joao Silva', percentual: 50, valor: 5000 }, { nomeSocio: 'Maria Souza', percentual: 50, valor: 5000 }] })).toBeTruthy(); });
  it('rejeita vazio', () => { expect(() => q06RedistribuicaoSchema.parse({ socios: [] })).toThrow(); });
});
});

describe('alteracaoFormDraftSchema', () => {
  it('aceita vazio', () => { expect(alteracaoFormDraftSchema.parse({})).toEqual({}); });
  it('rejeita chave invalida', () => { expect(() => alteracaoFormDraftSchema.parse({ x: 1 })).toThrow(); });
  it('aceita aceite false', () => { expect(alteracaoFormDraftSchema.parse({ aceite: false })).toHaveProperty('aceite', false); });
});
});

describe('stepTipoAlteracaoSchema', () => {
  it('aceita quadros', () => { expect(stepTipoAlteracaoSchema.parse({ quadros: ['nome_empresarial','endereco'] })).toBeTruthy(); });
  it('rejeita vazio', () => { expect(() => stepTipoAlteracaoSchema.parse({ quadros: [] })).toThrow(); });
  it('rejeita quadro invalido', () => { expect(() => stepTipoAlteracaoSchema.parse({ quadros: ['x'] })).toThrow(); });
});