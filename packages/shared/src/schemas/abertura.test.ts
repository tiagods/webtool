import { describe, it, expect } from 'vitest';
import {
  stepDadosEmpresaSchema,
  stepEnderecoSchema,
  socioSchema,
  stepSociosSchema,
  stepSociedadeSchema,
  aberturaFormSchema,
  aberturaFormDraftSchema,
} from './abertura';

// Step 1
describe('stepDadosEmpresaSchema', () => {
  const valido = {
    tipoConstituicao: 'ltda' as const,
    nomeEmpresarial1: 'Tech Solutions Ltda',
    nomeEmpresarial2: 'Tech Solutions Brasil Ltda',
    nomeEmpresarial3: 'TS Tecnologia Ltda',
    nomeFantasia: 'TechSol',
    atividade: 'Desenvolvimento de software e consultoria em TI',
  };

  it('aceita payload valido Ltda', () => {
    expect(stepDadosEmpresaSchema.parse(valido)).toEqual(valido);
  });

  it('aceita payload valido SLU', () => {
    const slu = { ...valido, tipoConstituicao: 'slu' as const };
    expect(stepDadosEmpresaSchema.parse(slu)).toEqual(slu);
  });

  it('rejeita tipoConstituicao invalido', () => {
    expect(() => stepDadosEmpresaSchema.parse({ ...valido, tipoConstituicao: 'xyz' })).toThrow();
  });

  it('rejeita nomeEmpresarial1 muito curto', () => {
    expect(() => stepDadosEmpresaSchema.parse({ ...valido, nomeEmpresarial1: 'AB' })).toThrow();
  });

  it('rejeita nomeEmpresarial2 muito curto', () => {
    expect(() => stepDadosEmpresaSchema.parse({ ...valido, nomeEmpresarial2: 'AB' })).toThrow();
  });

  it('rejeita nomeEmpresarial3 muito curto', () => {
    expect(() => stepDadosEmpresaSchema.parse({ ...valido, nomeEmpresarial3: 'AB' })).toThrow();
  });

  it('aceita nomeFantasia opcional ausente', () => {
    const { nomeFantasia, ...sem } = valido;
    expect(stepDadosEmpresaSchema.parse(sem)).not.toHaveProperty('nomeFantasia');
  });

  it('rejeita atividade muito curta', () => {
    expect(() => stepDadosEmpresaSchema.parse({ ...valido, atividade: 'Curta' })).toThrow();
  });

  it('rejeita objeto vazio', () => {
    expect(() => stepDadosEmpresaSchema.parse({})).toThrow();
  });
});

// Step 2
describe('stepEnderecoSchema', () => {
  const valido = {
    cep: '01001-000',
    logradouro: 'Av. Paulista',
    numero: '1000',
    complemento: 'Sala 42',
    bairro: 'Bela Vista',
    municipio: 'Sao Paulo',
    estado: 'SP',
    iptu: '123456',
    imovelAlugado: false,
  };

  it('aceita payload valido', () => {
    expect(stepEnderecoSchema.parse(valido)).toEqual(valido);
  });

  it('aceita complemento opcional', () => {
    const { complemento, ...sem } = valido;
    expect(stepEnderecoSchema.parse(sem)).not.toHaveProperty('complemento');
  });

  it('rejeita CEP invalido', () => {
    expect(() => stepEnderecoSchema.parse({ ...valido, cep: '12345' })).toThrow();
  });

// Step 3 - Socio
describe('socioSchema', () => {
  const valido = {
    nome: 'Joao da Silva',
    pis: '123.45678.90-1',
    cpf: '123.456.789-00',
    rg: '12.345.678-9 SSP/SP',
    nacionalidade: 'Brasileiro',
    profissao: 'Empresario',
    proLabore: 2500,
    telefoneCelular: '(11) 99999-9999',
    telefoneFixo: '(11) 3333-3333',
    email: 'joao@email.com',
    estadoCivil: 'solteiro',
    nomeMae: 'Maria da Silva',
    nomePai: 'Jose da Silva',
    cepRegistro: '02001-000',
    logradouroRegistro: 'Rua Augusta',
    numeroRegistro: '500',
    bairroRegistro: 'Consolacao',
    registroConselho: 'CRC/SP 12345',
    teveParticipacaoSocietaria: false,
  };

  it('aceita payload completo', () => {
    expect(socioSchema.parse(valido)).toEqual(valido);
  });

  it('aceita campos opcionais', () => {
    const { telefoneFixo, nomePai, registroConselho, ...sem } = valido;
    sem.teveParticipacaoSocietaria = false;
    const p = socioSchema.parse(sem);
    expect(p).not.toHaveProperty('telefoneFixo');
    expect(p).not.toHaveProperty('nomePai');
    expect(p).not.toHaveProperty('registroConselho');
  });

  it('rejeita CPF invalido', () => {
    expect(() => socioSchema.parse({ ...valido, cpf: '123.456.789-0' })).toThrow();
  });

  it('rejeita PIS invalido', () => {
    expect(() => socioSchema.parse({ ...valido, pis: '123.45678.90-0' })).toThrow();
  });

  it('rejeita proLabore baixo', () => {
    expect(() => socioSchema.parse({ ...valido, proLabore: 1000 })).toThrow();
  });

  it('aceita proLabore minimo', () => {
    expect(socioSchema.parse({ ...valido, proLabore: 1412 })).toHaveProperty('proLabore', 1412);
  });

  it('rejeita email invalido', () => {
    expect(() => socioSchema.parse({ ...valido, email: 'invalido' })).toThrow();
  });

  it('rejeita estadoCivil invalido', () => {
    expect(() => socioSchema.parse({ ...valido, estadoCivil: 'invalido' })).toThrow();
  });

  it('aceita todos estados civis', () => {
    const estados = ['solteiro','casado_comunhao_parcial','casado_comunhao_universal','casado_separacao_bens','casado_separacao_obrigatoria','viuvo','separado_judicialmente'] as const;
    for (const e of estados) {
      expect(socioSchema.parse({ ...valido, estadoCivil: e })).toHaveProperty('estadoCivil', e);
    }
  });
});

describe('stepSociosSchema', () => {
  it('rejeita array vazio', () => {
    expect(() => stepSociosSchema.parse({ socios: [] })).toThrow();
  });

  it('aceita array com 1 socio', () => {
// Step 4 - Sociedade
describe('stepSociedadeSchema', () => {
  const valido = {
    capitalSocial: 50000,
    quotas: [{ percentual: 60, isAdministrador: true }, { percentual: 40, isAdministrador: false }],
    tipoAdministracao: 'isoladamente' as const,
    banco: 'Banco do Brasil',
  };

  it('aceita payload valido', () => {
    expect(stepSociedadeSchema.parse(valido)).toEqual(valido);
  });

  it('rejeita capital zero', () => {
    expect(() => stepSociedadeSchema.parse({ ...valido, capitalSocial: 0 })).toThrow();
  });

  it('rejeita administracao invalida', () => {
    expect(() => stepSociedadeSchema.parse({ ...valido, tipoAdministracao: 'x' })).toThrow();
  });

  it('rejeita percentual < 0.01', () => {
    expect(() => stepSociedadeSchema.parse({ ...valido, quotas: [{ percentual: 0, isAdministrador: true }] })).toThrow();
  });

  it('rejeita percentual > 100', () => {
    expect(() => stepSociedadeSchema.parse({ ...valido, quotas: [{ percentual: 101, isAdministrador: true }] })).toThrow();
  });

  it('aceita admin conjunta e outras', () => {
    expect(stepSociedadeSchema.parse({ ...valido, tipoAdministracao: 'conjunta' })).toHaveProperty('tipoAdministracao', 'conjunta');
    expect(stepSociedadeSchema.parse({ ...valido, tipoAdministracao: 'outras' })).toHaveProperty('tipoAdministracao', 'outras');
it('aceita SLU 1 socio sem sociedade', () => {
    const r = aberturaFormSchema.parse(buildFormBase('slu'));
    expect(r.dadosEmpresa.tipoConstituicao).toBe('slu');
    expect(r.sociedade).toBeUndefined();
  });

  it('rejeita Ltda com 1 socio', () => {
    expect(() => aberturaFormSchema.parse(buildFormBase('ltda'))).toThrow();
  });

  it('rejeita quotas soma != 100', () => {
    const p = { ...buildFormBase('ltda'), dadosSocios: { socios: [...buildFormBase('ltda').dadosSocios.socios, socioExtra()] }, sociedade: { capitalSocial: 100000, quotas: [{ percentual: 30, isAdministrador: true }, { percentual: 30, isAdministrador: false }], tipoAdministracao: 'isoladamente', banco: 'Itau' } };
    expect(() => aberturaFormSchema.parse(p)).toThrow();
  });

  it('rejeita sem administrador', () => {
    const p = { ...buildFormBase('ltda'), dadosSocios: { socios: [...buildFormBase('ltda').dadosSocios.socios, socioExtra()] }, sociedade: { capitalSocial: 100000, quotas: [{ percentual: 50, isAdministrador: false }, { percentual: 50, isAdministrador: false }], tipoAdministracao: 'isoladamente', banco: 'Itau' } };
    expect(() => aberturaFormSchema.parse(p)).toThrow();
  });

  it('rejeita quotas != socios count', () => {
    const p = { ...buildFormBase('ltda'), dadosSocios: { socios: [...buildFormBase('ltda').dadosSocios.socios, socioExtra()] }, sociedade: { capitalSocial: 100000, quotas: [{ percentual: 100, isAdministrador: true }], tipoAdministracao: 'isoladamente', banco: 'Itau' } };
    expect(() => aberturaFormSchema.parse(p)).toThrow();
  });

  it('rejeita documentosAceitos false', () => {
    expect(() => aberturaFormSchema.parse({ ...buildFormBase('slu'), documentosAceitos: false })).toThrow();
  });

  it('rejeita socio participacao sem CNPJ', () => {
    const p = { ...buildFormBase('slu'), dadosSocios: { socios: [{ ...buildFormBase('slu').dadosSocios.socios[0], teveParticipacaoSocietaria: true }] } };
    expect(() => aberturaFormSchema.parse(p)).toThrow();
  });

  it('aceita socio participacao com CNPJ', () => {
    const p = { ...buildFormBase('slu'), dadosSocios: { socios: [{ ...buildFormBase('slu').dadosSocios.socios[0], teveParticipacaoSocietaria: true, cnpjParticipacao: '12.345.678/0001-90' }] } };
    expect(() => aberturaFormSchema.parse(p)).not.toThrow();
  });
});

// Draft Schema
describe('aberturaFormDraftSchema', () => {
  it('aceita objeto vazio', () => {
    expect(aberturaFormDraftSchema.parse({})).toEqual({});
  });

  it('aceita objeto parcial', () => {
    const r = aberturaFormDraftSchema.parse({ dadosEmpresa: { nomeEmpresarial1: 'Teste' } });
    expect(r.dadosEmpresa?.nomeEmpresarial1).toBe('Teste');
  });

  it('rejeita chave desconhecida', () => {
    expect(() => aberturaFormDraftSchema.parse({ xyz: 1 })).toThrow();
  });

  it('aceita documentosAceitos false', () => {
    expect(aberturaFormDraftSchema.parse({ documentosAceitos: false })).toHaveProperty('documentosAceitos', false);
  });
});
  });
});

// Helper functions
function buildFormBase(sociedade?: 'ltda' | 'slu') {
  return {
    dadosEmpresa: {
      tipoConstituicao: sociedade ?? 'ltda',
      nomeEmpresarial1: 'Tech Solutions Ltda',
      nomeEmpresarial2: 'Tech Solutions Brasil Ltda',
      nomeEmpresarial3: 'TS Tecnologia Ltda',
      nomeFantasia: 'TechSol',
      atividade: 'Desenvolvimento de software e consultoria em TI',
    },
    endereco: { cep: '01001-000', logradouro: 'Av. Paulista', numero: '1000', bairro: 'Bela Vista', municipio: 'Sao Paulo', estado: 'SP', iptu: '123456', imovelAlugado: false },
    dadosSocios: { socios: [{ nome: 'Joao da Silva', pis: '123.45678.90-1', cpf: '123.456.789-00', rg: '12.345.678-9 SSP/SP', nacionalidade: 'Brasileiro', profissao: 'Empresario', proLabore: 2500, telefoneCelular: '(11) 99999-9999', email: 'joao@email.com', estadoCivil: 'solteiro', nomeMae: 'Maria da Silva', cepRegistro: '02001-000', logradouroRegistro: 'Rua Augusta', numeroRegistro: '500', bairroRegistro: 'Consolacao', teveParticipacaoSocietaria: false }] },
    documentosAceitos: true,
  };
}
