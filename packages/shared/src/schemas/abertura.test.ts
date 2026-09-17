import { describe, it, expect } from 'vitest';
import { stepDadosEmpresaSchema, stepEnderecoSchema, socioSchema, stepSociosSchema, quotaSocioSchema, stepSociedadeSchema, aberturaFormSchema, aberturaFormDraftSchema } from './abertura';

describe('stepDadosEmpresaSchema', () => {
  const v = { tipoConstituicao: 'ltda' as const, nomeEmpresarial1: 'ABC Ltda', nomeEmpresarial2: 'DEF Ltda', nomeEmpresarial3: 'GHI Ltda', nomeFantasia: 'Fantasia', atividade: 'Descricao com mais de 20 caracteres para teste' };
  it('aceita Ltda', () => { expect(stepDadosEmpresaSchema.parse(v)).toEqual(v); });
  it('aceita SLU', () => { expect(stepDadosEmpresaSchema.parse({ ...v, tipoConstituicao: 'slu' as const })).toBeTruthy(); });
  it('rejeita tipo invalido', () => { expect(() => stepDadosEmpresaSchema.parse({ ...v, tipoConstituicao: 'x' })).toThrow(); });
  it('rejeita nome1 curto', () => { expect(() => stepDadosEmpresaSchema.parse({ ...v, nomeEmpresarial1: 'AB' })).toThrow(); });
  it('rejeita nome2 curto', () => { expect(() => stepDadosEmpresaSchema.parse({ ...v, nomeEmpresarial2: 'AB' })).toThrow(); });
  it('rejeita nome3 curto', () => { expect(() => stepDadosEmpresaSchema.parse({ ...v, nomeEmpresarial3: 'AB' })).toThrow(); });
  it('aceita nomeFantasia opcional', () => { const { nomeFantasia, ...s } = v; expect(stepDadosEmpresaSchema.parse(s)).not.toHaveProperty('nomeFantasia'); });
  it('rejeita atividade curta', () => { expect(() => stepDadosEmpresaSchema.parse({ ...v, atividade: 'Curta' })).toThrow(); });
});

describe('stepEnderecoSchema', () => {
  const v = { cep: '01001-000', logradouro: 'Rua X', numero: '100', complemento: 'Apto 42', bairro: 'Bela Vista', municipio: 'Sao Paulo', estado: 'SP', iptu: '123', imovelAlugado: false };
  it('aceita valido', () => { expect(stepEnderecoSchema.parse(v)).toEqual(v); });
  it('aceita complemento opcional', () => { const { complemento, ...s } = v; expect(stepEnderecoSchema.parse(s)).not.toHaveProperty('complemento'); });
  it('rejeita CEP', () => { expect(() => stepEnderecoSchema.parse({ ...v, cep: '12' })).toThrow(); });
  it('rejeita logradouro curto', () => { expect(() => stepEnderecoSchema.parse({ ...v, logradouro: 'A' })).toThrow(); });
  it('rejeita estado invalido', () => { expect(() => stepEnderecoSchema.parse({ ...v, estado: 'S' })).toThrow(); });
describe('socioSchema', () => {
  const v = { nome: 'Joao Silva', pis: '123.45678.90-1', cpf: '123.456.789-00', rg: 'RG 12345', nacionalidade: 'Brasileiro', profissao: 'Empresario', proLabore: 2000, telefoneCelular: '(11) 99999-9999', telefoneFixo: '(11) 3333-3333', email: 'a@b.com', estadoCivil: 'solteiro', nomeMae: 'Maria Silva', nomePai: 'Jose Silva', cepRegistro: '02001-000', logradouroRegistro: 'Rua Y', numeroRegistro: '50', complementoRegistro: 'Sala 1', bairroRegistro: 'Centro', registroConselho: 'CRC/SP 123', teveParticipacaoSocietaria: false };
  it('aceita completo', () => { expect(socioSchema.parse(v)).toEqual(v); });
  it('aceita opcionais', () => { const { telefoneFixo, nomePai, complementoRegistro, registroConselho, ...s } = v; s.teveParticipacaoSocietaria = false; const r = socioSchema.parse(s); expect(r).not.toHaveProperty('telefoneFixo'); expect(r).not.toHaveProperty('nomePai'); });
  it('rejeita nome curto', () => { expect(() => socioSchema.parse({ ...v, nome: 'AB' })).toThrow(); });
  it('rejeita CPF', () => { expect(() => socioSchema.parse({ ...v, cpf: '123' })).toThrow(); });
  it('rejeita PIS', () => { expect(() => socioSchema.parse({ ...v, pis: '123' })).toThrow(); });
  it('rejeita proLabore baixo', () => { expect(() => socioSchema.parse({ ...v, proLabore: 1000 })).toThrow(); });
  it('rejeita email', () => { expect(() => socioSchema.parse({ ...v, email: 'x' })).toThrow(); });
  it('rejeita estadoCivil invalido', () => { expect(() => socioSchema.parse({ ...v, estadoCivil: 'x' })).toThrow(); });
  it('rejeita celular curto', () => { expect(() => socioSchema.parse({ ...v, telefoneCelular: '11' })).toThrow(); });
  it('aceita todos estados civis', () => { for (const e of ['solteiro','casado_comunhao_parcial','casado_comunhao_universal','casado_separacao_bens','casado_separacao_obrigatoria','viuvo','separado_judicialmente'] as const) { expect(socioSchema.parse({ ...v, estadoCivil: e })).toHaveProperty('estadoCivil', e); } });
});

describe('stepSociosSchema', () => {
  const sf = { nome: 'Joao Silva', pis: '123.45678.90-1', cpf: '123.456.789-00', rg: 'RG 12345', nacionalidade: 'Brasileiro', profissao: 'Empresario', proLabore: 2000, telefoneCelular: '(11) 99999-9999', email: 'a@b.com', estadoCivil: 'solteiro', nomeMae: 'Maria Silva', cepRegistro: '02001-000', logradouroRegistro: 'Rua Y', numeroRegistro: '50', bairroRegistro: 'Centro', teveParticipacaoSocietaria: false };
  it('rejeita socios vazio', () => { expect(() => stepSociosSchema.parse({ socios: [] })).toThrow(); });
  it('aceita 1 socio', () => { expect(stepSociosSchema.parse({ socios: [sf] })).toBeTruthy(); });
});

describe('quotaSocioSchema', () => {
  it('aceita valido', () => { expect(quotaSocioSchema.parse({ percentual: 50, isAdministrador: true })).toEqual({ percentual: 50, isAdministrador: true }); });
  it('rejeita < 0.01', () => { expect(() => quotaSocioSchema.parse({ percentual: 0, isAdministrador: true })).toThrow(); });
  it('rejeita > 100', () => { expect(() => quotaSocioSchema.parse({ percentual: 101, isAdministrador: true })).toThrow(); });
});

describe('stepSociedadeSchema', () => {
  const v = { capitalSocial: 50000, quotas: [{ percentual: 60, isAdministrador: true }, { percentual: 40, isAdministrador: false }], tipoAdministracao: 'isoladamente' as const, banco: 'BB' };
  it('aceita valido', () => { expect(stepSociedadeSchema.parse(v)).toEqual(v); });
  it('rejeita capital zero', () => { expect(() => stepSociedadeSchema.parse({ ...v, capitalSocial: 0 })).toThrow(); });
  it('rejeita admin invalida', () => { expect(() => stepSociedadeSchema.parse({ ...v, tipoAdministracao: 'x' })).toThrow(); });
describe('aberturaFormSchema', () => {
  const sf = { nome: 'Joao Silva', pis: '123.45678.90-1', cpf: '123.456.789-00', rg: 'RG 12345', nacionalidade: 'Brasileiro', profissao: 'Empresario', proLabore: 2000, telefoneCelular: '(11) 99999-9999', email: 'a@b.com', estadoCivil: 'solteiro', nomeMae: 'Maria Silva', cepRegistro: '02001-000', logradouroRegistro: 'Rua Y', numeroRegistro: '50', bairroRegistro: 'Centro', teveParticipacaoSocietaria: false };
  const base = {
    dadosEmpresa: { tipoConstituicao: 'ltda' as const, nomeEmpresarial1: 'Empresa A', nomeEmpresarial2: 'Empresa B', nomeEmpresarial3: 'Empresa C', nomeFantasia: 'F', atividade: 'descricao acima de 20 chars ok........' },
    endereco: { cep: '01001-000', logradouro: 'Rua Teste', numero: '1', bairro: 'Bela Vista', municipio: 'Sao Paulo', estado: 'SP', iptu: '1', imovelAlugado: false },
    dadosSocios: { socios: [sf, { ...sf, nome: 'Maria Souza', cpf: '987.654.321-00', pis: '987.65432.10-2' }] },
    sociedade: { capitalSocial: 1000, quotas: [{ percentual: 60, isAdministrador: true }, { percentual: 40, isAdministrador: true }], tipoAdministracao: 'conjunta', banco: 'BB' },
    documentosAceitos: true,
  };
  it('aceita Ltda 2 socios', () => { expect(aberturaFormSchema.parse(base)).toBeTruthy(); });
  it('rejeita Ltda 1 socio (refine)', () => { expect(() => aberturaFormSchema.parse({ ...base, dadosSocios: { socios: [sf] } })).toThrow(/requer pelo menos 2 s.cios/); });
  it('rejeita quotas soma != 100 (refine)', () => { expect(() => aberturaFormSchema.parse({ ...base, sociedade: { ...base.sociedade, quotas: [{ percentual: 30, isAdministrador: true }, { percentual: 30, isAdministrador: false }] } })).toThrow(/soma das quotas/); });
  it('rejeita sem admin (refine)', () => { expect(() => aberturaFormSchema.parse({ ...base, sociedade: { ...base.sociedade, quotas: [{ percentual: 50, isAdministrador: false }, { percentual: 50, isAdministrador: false }] } })).toThrow(/ao menos 1 administrador/); });
  it('rejeita quotas != socios count (refine)', () => { expect(() => aberturaFormSchema.parse({ ...base, sociedade: { ...base.sociedade, quotas: [{ percentual: 100, isAdministrador: true }] } })).toThrow(/Cada s.cio precisa/); });
  it('rejeita participacao sem CNPJ (refine)', () => { expect(() => aberturaFormSchema.parse({ ...base, dadosEmpresa: { ...base.dadosEmpresa, tipoConstituicao: 'slu' as const }, dadosSocios: { socios: [{ ...sf, teveParticipacaoSocietaria: true }] } })).toThrow(/CNPJ da empresa anterior/); });
it('rejeita Ltda sem sociedade (refine)', () => { const { sociedade, ...semSociedade } = base; expect(() => aberturaFormSchema.parse(semSociedade)).toThrow(/Preencha os dados da sociedade/); });
  it('rejeita aceite false', () => { expect(() => aberturaFormSchema.parse({ ...base, documentosAceitos: false })).toThrow(/aceitar os termos/); });
});

describe('aberturaFormDraftSchema', () => {
  it('aceita vazio', () => { expect(aberturaFormDraftSchema.parse({})).toEqual({}); });
  it('aceita dadosEmpresa completo', () => { const r = aberturaFormDraftSchema.parse({ dadosEmpresa: { tipoConstituicao: 'ltda', nomeEmpresarial1: 'Empresa A Ltda', nomeEmpresarial2: 'Empresa B Ltda', nomeEmpresarial3: 'Empresa C Ltda', nomeFantasia: 'Fantasia', atividade: 'descricao com mais de 20 caracteres para testes' } }); expect(r.dadosEmpresa?.nomeEmpresarial1).toBe('Empresa A Ltda'); });
  it('rejeita chave desconhecida', () => { expect(() => aberturaFormDraftSchema.parse({ x: 1 })).toThrow(); });
  it('aceita documentosAceitos false', () => { expect(aberturaFormDraftSchema.parse({ documentosAceitos: false })).toHaveProperty('documentosAceitos', false); });
});
  it('aceita admin conjunta', () => { expect(stepSociedadeSchema.parse({ ...v, tipoAdministracao: 'conjunta' })).toHaveProperty('tipoAdministracao', 'conjunta'); });
  it('aceita admin outras', () => { expect(stepSociedadeSchema.parse({ ...v, tipoAdministracao: 'outras' })).toHaveProperty('tipoAdministracao', 'outras'); });
});
  it('rejeita iptu vazio', () => { expect(() => stepEnderecoSchema.parse({ ...v, iptu: '' })).toThrow(); });
  it('aceita imovelAlugado true', () => { expect(stepEnderecoSchema.parse({ ...v, imovelAlugado: true })).toHaveProperty('imovelAlugado', true); });
});