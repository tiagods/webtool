import { describe, it, expect } from 'vitest';
import { registroAceiteSchema, aceiteTermoRequestSchema } from './aceite';

describe('registroAceiteSchema', () => {
  const valido = {
    sessionId: 'sess_abc123',
    versaoTermo: 'v1.0',
    aceitoEm: '2026-09-16T10:00:00Z',
    ip: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
  };

  it('aceita payload válido', () => {
    expect(registroAceiteSchema.parse(valido)).toEqual(valido);
  });

  it('rejeita sessionId vazio', () => {
    expect(() =>
      registroAceiteSchema.parse({ ...valido, sessionId: '' }),
    ).toThrow();
  });

  it('rejeita versaoTermo vazio', () => {
    expect(() =>
      registroAceiteSchema.parse({ ...valido, versaoTermo: '' }),
    ).toThrow();
  });

  it('rejeita objeto vazio', () => {
    expect(() => registroAceiteSchema.parse({})).toThrow();
  });
});

describe('aceiteTermoRequestSchema', () => {
  it('aceita payload válido', () => {
    expect(aceiteTermoRequestSchema.parse({ versaoTermo: 'v1.0' })).toEqual({ versaoTermo: 'v1.0' });
  });

  it('rejeita versaoTermo vazio', () => {
    expect(() => aceiteTermoRequestSchema.parse({ versaoTermo: '' })).toThrow();
  });

  it('rejeita objeto vazio', () => {
    expect(() => aceiteTermoRequestSchema.parse({})).toThrow();
  });
});