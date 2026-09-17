import { describe, it, expect } from 'vitest';
import {
  stepIdentificacaoSchema,
  stepTipoAlteracaoSchema,
  q01NomeEmpresarialSchema,
  q02ObjetoSocialSchema,
  q03EnderecoSchema,
  q07NaturezaJuridicaSchema,
  alteracaoFormSchema,
  alteracaoFormDraftSchema,
} from './alteracao';

describe('stepIdentificacaoSchema', () => {
  const valido = {
    cnpj: '12.345.678/0001-90',
    razaoSocial: 'Empresa Exemplo Ltda',
    nomeFantasia: 'Exemplo',
    tipoConstituicao: 'ltda' as const,
    enderecoAtual: {
      logradouro: 'Av. Paulista, 1000',
      bairro: 'Bela Vista',
      municipio: 'Sao Paulo',
      estado: 'SP',
      cep: '01001-000',
    },
    situacao: 'ativa' as const,
  };

  it('aceita payload válido (ativa)', () => {
    expect(stepIdentificacaoSchema.parse(valido)).toEqual(valido);
  });

  it('rejeita situação inapta', () => {
    expect(() =>
      stepIdentificacaoSchema.parse({ ...valido, situacao: 'inapta' }),
    ).toThrow(/ATIVA/);
  });

  it('rejeita situação baixada', () => {
    expect(() =>
      stepIdentificacaoSchema.parse({ ...valido, situacao: 'baixada' }),
    ).toThrow(/ATIVA/);
  });

  it('rejeita CNPJ inválido', () => {
    expect(() =>
      stepIdentificacaoSchema.parse({ ...valido, cnpj: '123' }),
    ).toThrow(/CNPJ inv.lido/);
  });

  it('aceita nomeFantasia opcional', () => {
    const { nomeFantasia, ...sem } = valido;
    expect(stepIdentificacaoSchema.parse(sem)).not.toHaveProperty('nomeFantasia');
  });

  it('rejeita objeto vazio', () => {
    expect(() => stepIdentificacaoSchema.parse({})).toThrow();
  });
});

describe('stepTipoAlteracaoSchema', () => {
  it('aceita array com quadros válidos', () => {
    expect(stepTipoAlteracaoSchema.parse({ quadros: ['nome_empresarial', 'endereco'] })).toEqual({ quadros: ['nome_empresarial', 'endereco'] });
  });

  it('rejeita array vazio', () => {
    expect(() => stepTipoAlteracaoSchema.parse({ quadros: [] })).toThrow(/Selecione pelo menos/);
  });

  it('rejeita quadro inválido', () => {
describe('q01NomeEmpresarialSchema', () => {
  it('aceita payload válido', () => {
    expect(q01NomeEmpresarialSchema.parse({
      nomeEmpresarial1: 'Nova Razao Ltda',
      nomeEmpresarial2: 'Nova Razao 2 Ltda',
      nomeEmpresarial3: 'Nova Razao 3 Ltda',
    })).toBeDefined();
  });

  it('rejeita nome curto', () => {
    expect(() =>
      q01NomeEmpresarialSchema.parse({ nomeEmpresarial1: 'AB', nomeEmpresarial2: 'CD', nomeEmpresarial3: 'EF' }),
    ).toThrow(/m.n\. 3 caracteres/);
  });
});

describe('q02ObjetoSocialSchema', () => {
  it('aceita payload válido', () => {
    expect(q02ObjetoSocialSchema.parse({
      novoObjetoSocial: 'Prestacao de servicos de consultoria em tecnologia da informacao',
    })).toBeDefined();
  });

  it('rejeita descricao curta', () => {
    expect(() =>
      q02ObjetoSocialSchema.parse({ novoObjetoSocial: 'Curta' }),
    ).toThrow(/m.n\. 20 caracteres/);
  });
});

describe('q03EnderecoSchema', () => {
  it('aceita payload válido', () => {
    expect(q03EnderecoSchema.parse({
      logradouro: 'Rua Nova, 500',
      bairro: 'Centro',
      municipio: 'Sao Paulo',
      estado: 'SP',
      cep: '02001-000',
      iptu: '654321',
    })).toBeDefined();
  });

  it('rejeita CEP inválido', () => {
    expect(() =>
      q03EnderecoSchema.parse({ logradouro: 'Rua', bairro: 'Centro', municipio: 'SP', estado: 'SP', cep: '123', iptu: '1' }),
    ).toThrow(/CEP inv.lido/);
  });
});

describe('q07NaturezaJuridicaSchema', () => {
  it('aceita transformacao ltda_para_simples', () => {
    expect(q07NaturezaJuridicaSchema.parse({ tipoTransformacao: 'ltda_para_simples' })).toBeDefined();
  });

  it('rejeita tipo "outras" sem especificar', () => {
    expect(() =>
      q07NaturezaJuridicaSchema.parse({ tipoTransformacao: 'outras' }),
    ).toThrow(/Especifique/);
  });

  it('aceita tipo "outras" com especificacao', () => {
    expect(q07NaturezaJuridicaSchema.parse({ tipoTransformacao: 'outras', especificar: 'Transformacao X' })).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Master Schema — alteracaoFormSchema (com superRefine + aceite refine)
// ---------------------------------------------------------------------------
describe('alteracaoFormSchema (superRefine)', () => {
  function basePayload() {
    return {
      identificacao: {
        cnpj: '12.345.678/0001-90',
        razaoSocial: 'Empresa Exemplo Ltda',
        tipoConstituicao: 'ltda' as const,
        enderecoAtual: { logradouro: 'Rua A', bairro: 'Centro', municipio: 'SP', estado: 'SP', cep: '01001-000' },
        situacao: 'ativa' as const,
      },
      quadros: ['nome_empresarial'] as Array<'nome_empresarial'>,
      q01: { nomeEmpresarial1: 'Nova Razao Ltda', nomeEmpresarial2: 'Nova Razao 2 Ltda', nomeEmpresarial3: 'Nova Razao 3 Ltda' },
      aceite: true,
    };
  }

  it('aceita payload com quadro preenchido', () => {
    expect(alteracaoFormSchema.parse(basePayload())).toBeDefined();
  });

  it('rejeita quadro selecionado sem dados preenchidos', () => {
    const { q01, ...semQ01 } = basePayload();
    expect(() => alteracaoFormSchema.parse(semQ01)).toThrow(/Preencha os dados do quadro/);
  });

  it('rejeita aceite false', () => {
    expect(() =>
      alteracaoFormSchema.parse({ ...basePayload(), aceite: false }),
    ).toThrow(/aceitar os termos/);
  });

  it('rejeita múltiplos quadros sem preenchimento', () => {
    expect(() =>
      alteracaoFormSchema.parse({
        ...basePayload(),
        quadros: ['nome_empresarial', 'objeto_social'],
      }),
    ).toThrow(/Preencha os dados do quadro/);
  });
});

// ---------------------------------------------------------------------------
// Draft Schema — alteracaoFormDraftSchema (.strict() + .partial())
// ---------------------------------------------------------------------------
describe('alteracaoFormDraftSchema', () => {
  it('aceita objeto vazio', () => {
    expect(alteracaoFormDraftSchema.parse({})).toEqual({});
  });

  it('rejeita chave desconhecida', () => {
    expect(() => alteracaoFormDraftSchema.parse({ invalido: true })).toThrow();
  });

  it('aceita aceite false (sem refine)', () => {
    expect(alteracaoFormDraftSchema.parse({ aceite: false })).toHaveProperty('aceite', false);
  });
});
    expect(() => stepTipoAlteracaoSchema.parse({ quadros: ['invalido'] })).toThrow();
  });

  it('aceita todos os 9 quadros', () => {
    const todos = [
      'nome_empresarial', 'objeto_social', 'endereco',
      'quadro_societario', 'capital_social', 'redistribuicao_capital',
      'natureza_juridica', 'administracao', 'outras_alteracoes',
    ];
    expect(stepTipoAlteracaoSchema.parse({ quadros: todos })).toEqual({ quadros: todos });
  });
});