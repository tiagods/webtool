import { describe, expect, it } from 'vitest';
import { UF_OPTIONS } from '@/lib/uf';

describe('lib/uf', () => {
  it('lista as 27 unidades federativas', () => {
    expect(UF_OPTIONS).toHaveLength(27);
  });

  it('não repete siglas e usa siglas de 2 letras', () => {
    const siglas = UF_OPTIONS.map((uf) => uf.value);
    expect(new Set(siglas).size).toBe(27);
    for (const sigla of siglas) {
      expect(sigla).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('inclui São Paulo com o rótulo correto', () => {
    expect(UF_OPTIONS.find((uf) => uf.value === 'SP')).toEqual({ value: 'SP', label: 'São Paulo' });
  });
});