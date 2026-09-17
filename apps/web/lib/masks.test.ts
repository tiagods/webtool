import { describe, expect, it } from 'vitest';
import { CEP_MASK, CNPJ_MASK, CPF_MASK, CURRENCY_MASK, PHONE_MASK, PIS_MASK } from '@/lib/masks';

describe('lib/masks', () => {
  it('expõe as máscaras de documentos no formato esperado', () => {
    expect(CEP_MASK).toBe('00000-000');
    expect(CPF_MASK).toBe('000.000.000-00');
    expect(CNPJ_MASK).toBe('00.000.000/0000-00');
    expect(PIS_MASK).toBe('000.00000.00-0');
  });

  it('oferece máscara de telefone para celular e fixo', () => {
    expect(PHONE_MASK).toHaveLength(2);
    expect(PHONE_MASK[0]).toEqual({ mask: '(00) 00000-0000' });
    expect(PHONE_MASK[1]).toEqual({ mask: '(00) 0000-0000' });
  });

  it('configura a máscara de moeda com separadores pt-BR', () => {
    expect(CURRENCY_MASK.mask).toBe('R$ num');
    expect(CURRENCY_MASK.blocks?.num).toMatchObject({
      scale: 2,
      thousandsSeparator: '.',
      radix: ',',
      mapToRadix: ['.'],
      min: 0,
    });
  });
});