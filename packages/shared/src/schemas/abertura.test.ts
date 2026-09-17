import { describe, it, expect } from 'vitest';
import { stepDadosEmpresaSchema, stepEnderecoSchema, socioSchema, stepSociosSchema, stepSociedadeSchema, aberturaFormSchema, aberturaFormDraftSchema } from './abertura';

describe('stepDadosEmpresaSchema', () => {
  const v = { tipoConstituicao: 'ltda' as const, nomeEmpresarial1: 'ABC Ltda', nomeEmpresarial2: 'ABC 2 Ltda', nomeEmpresarial3: 'ABC 3 Ltda', nomeFantasia: 'Fantasia', atividade: 'Descricao com mais de 20 caracteres para teste' };
  it('aceita Ltda', () => { expect(stepDadosEmpresaSchema.parse(v)).toEqual(v); });
  it('aceita SLU', () => { expect(stepDadosEmpresaSchema.parse({ ...v, tipoConstituicao: 'slu' as const })).toBeTruthy(); });
  it('rejeita tipo invalido', () => { expect(() => stepDadosEmpresaSchema.parse({ ...v, tipoConstituicao: 'x' })).toThrow(); });
});

describe('stepEnderecoSchema', () => {
  const v = { cep: '01001-000', logradouro: 'Rua X', numero: '100', bairro: 'Bela Vista', municipio: 'Sao Paulo', estado: 'SP', iptu: '123', imovelAlugado: false };
  it('aceita valido', () => { expect(stepEnderecoSchema.parse(v)).toEqual(v); });
  it('rejeita CEP', () => { expect(() => stepEnderecoSchema.parse({ ...v, cep: '123' })).toThrow(); });
  it('rejeita vazio', () => { expect(() => stepEnderecoSchema.parse({})).toThrow(); });
});

describe('socioSchema', () => {
  const v = { nome: 'Joao', pis: '123.45678.90-1', cpf: '123.456.789-00', rg: 'RG 123', nacionalidade: 'Brasileiro', profissao: 'Empresario', proLabore: 2000, telefoneCelular: '(11)99999-9999', email: 'a@b.com', estadoCivil: 'solteiro', nomeMae: 'Maria', cepRegistro: '02001-000', logradouroRegistro: 'Rua Y', numeroRegistro: '50', bairroRegistro: 'Centro', teveParticipacaoSocietaria: false };
  it('aceita valido', () => { expect(socioSchema.parse(v)).toEqual(v); });
  it('rejeita CPF', () => { expect(() => socioSchema.parse({ ...v, cpf: '123' })).toThrow(); });
});

describe('stepSociosSchema', () => {
  it('rejeita vazio', () => { expect(() => stepSociosSchema.parse({ socios: [] })).toThrow(); });
});

describe('stepSociedadeSchema', () => {
  const v = { capitalSocial: 50000, quotas: [{ percentual: 100, isAdministrador: true }], tipoAdministracao: 'isoladamente', banco: 'BB' };
  it('aceita valido', () => { expect(stepSociedadeSchema.parse(v)).toEqual(v); });
  it('rejeita capital zero', () => { expect(() => stepSociedadeSchema.parse({ ...v, capitalSocial: 0 })).toThrow(); });
});

describe('aberturaFormSchema', () => {
  const sf = { nome: 'Joao Silva', pis: '123.45678.90-1', cpf: '123.456.789-00', rg: 'RG 12345', nacionalidade: 'Brasileiro', profissao: 'Empresario', proLabore: 2000, telefoneCelular: '(11)99999-9999', email: 'a@b.com', estadoCivil: 'solteiro', nomeMae: 'Maria Silva', cepRegistro: '02001-000', logradouroRegistro: 'Rua Y', numeroRegistro: '50', bairroRegistro: 'Centro', teveParticipacaoSocietaria: false };
  const base = {
    dadosEmpresa: { tipoConstituicao: 'ltda', nomeEmpresarial1: 'Empresa A Ltda', nomeEmpresarial2: 'Empresa B Ltda', nomeEmpresarial3: 'Empresa C Ltda', nomeFantasia: 'Fantasia', atividade: 'descricao acima de 20 chars ok' },
    endereco: { cep: '01001-000', logradouro: 'Rua Teste', numero: '1', bairro: 'Bela Vista', municipio: 'Sao Paulo', estado: 'SP', iptu: '1', imovelAlugado: false },
    dadosSocios: { socios: [sf, { ...sf, nome: 'Maria', cpf: '987.654.321-00', pis: '123.45678.90-2' }] },
    sociedade: { capitalSocial: 1000, quotas: [{ percentual: 60, isAdministrador: true }, { percentual: 40, isAdministrador: true }], tipoAdministracao: 'conjunta', banco: 'BB' },
    documentosAceitos: true,
  };
  it('aceita Ltda completo', () => { expect(aberturaFormSchema.parse(base)).toBeTruthy(); });
  it('rejeita 1 socio Ltda', () => { expect(() => aberturaFormSchema.parse({ ...base, dadosSocios: { socios: [sf] } })).toThrow(); });
  it('rejeita aceite false', () => { expect(() => aberturaFormSchema.parse({ ...base, documentosAceitos: false })).toThrow('aceitar os termos'); });
});

describe('aberturaFormDraftSchema', () => {
  it('aceita vazio', () => { expect(aberturaFormDraftSchema.parse({})).toEqual({}); });
  it('rejeita chave invalida', () => { expect(() => aberturaFormDraftSchema.parse({ x: 1 })).toThrow(); });
});