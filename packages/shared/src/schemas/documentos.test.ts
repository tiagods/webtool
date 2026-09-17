import { describe, it, expect } from 'vitest';
import { documentosSocioSchema, documentosImovelSchema, documentosFormSchema } from './documentos';

describe('documentoSocioSchema', () => {
  const valido = {
    rgFrente: { s3Key: 'uploads/sess_abc/rg_frente.pdf' },
    rgVerso: { s3Key: 'uploads/sess_abc/rg_verso.pdf' },
    cpf: { s3Key: 'uploads/sess_abc/cpf.pdf' },
    comprovanteResidencia: { s3Key: 'uploads/sess_abc/comprovante.pdf' },
    irpf2024: { s3Key: 'uploads/sess_abc/irpf2024.pdf' },
    irpf2025: { s3Key: 'uploads/sess_abc/irpf2025.pdf' },
    tituloEleitor: { s3Key: 'uploads/sess_abc/titulo.pdf' },
  };

  it('aceita payload válido', () => {
    expect(documentosSocioSchema.parse(valido)).toEqual(valido);
  });

  it('rejeita s3Key vazio', () => {
    expect(() =>
      documentosSocioSchema.parse({ ...valido, rgFrente: { s3Key: '' } }),
    ).toThrow();
  });

  it('rejeita objeto vazio', () => {
    expect(() => documentosSocioSchema.parse({})).toThrow();
  });
});

describe('documentosImovelSchema', () => {
  it('aceita payload com iptu apenas', () => {
    expect(documentosImovelSchema.parse({ iptu: { s3Key: 'iptu.pdf' } })).toEqual({ iptu: { s3Key: 'iptu.pdf' } });
  });

  it('rejeita objeto vazio', () => {
    expect(() => documentosImovelSchema.parse({})).toThrow();
  });
});

describe('documentosFormSchema', () => {
  it('aceita payload com socios e imovel', () => {
    const payload = {
      socios: [{
        rgFrente: { s3Key: 'a.pdf' },
        rgVerso: { s3Key: 'b.pdf' },
        cpf: { s3Key: 'c.pdf' },
        comprovanteResidencia: { s3Key: 'd.pdf' },
        irpf2024: { s3Key: 'e.pdf' },
        irpf2025: { s3Key: 'f.pdf' },
        tituloEleitor: { s3Key: 'g.pdf' },
      }],
      imovel: { iptu: { s3Key: 'h.pdf' } },
    };
    expect(documentosFormSchema.parse(payload)).toEqual(payload);
  });

  it('rejeita socios com campo inválido', () => {
    expect(() =>
      documentosFormSchema.parse({ socios: [{ rgFrente: { s3Key: '' } }], imovel: { iptu: { s3Key: 'x.pdf' } } }),
    ).toThrow();
  });

  it('rejeita objeto vazio', () => {
    expect(() => documentosFormSchema.parse({})).toThrow();
  });
});