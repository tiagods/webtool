import { describe, it, expect } from 'vitest';
import { TERMO_VERSAO_ATUAL } from './termo';

describe('TERMO_VERSAO_ATUAL', () => {
  it('tem o valor esperado', () => {
    expect(TERMO_VERSAO_ATUAL).toBe('v1.0');
  });

  it('é uma string não vazia', () => {
    expect(TERMO_VERSAO_ATUAL.length).toBeGreaterThan(0);
  });
});