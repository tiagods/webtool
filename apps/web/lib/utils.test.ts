import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('junta classes múltiplas', () => {
    expect(cn('flex', 'items-center')).toBe('flex items-center');
  });

  it('ignora valores falsy', () => {
    expect(cn('flex', false && 'hidden', undefined, null, '')).toBe('flex');
  });

  it('resolve conflitos do Tailwind mantendo a última classe', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('aceita classes condicionais em objeto', () => {
    expect(cn('base', { ativo: true, inativo: false })).toBe('base ativo');
  });
});