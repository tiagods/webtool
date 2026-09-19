import { describe, expect, it } from 'vitest';
import {
  TERMO_BASE_LEGAL,
  TERMO_CHECKBOX_LABEL,
  TERMO_CONTATO_EMAIL,
  TERMO_FINALIDADE,
  TERMO_INTRODUCAO,
  TERMO_ITENS,
  TERMO_RECUSA_MENSAGEM,
  TERMO_RETENCAO,
  TERMO_TITULO,
} from '@/lib/termo';

describe('lib/termo', () => {
  it('expõe o texto do termo de ciência', () => {
    expect(TERMO_TITULO).toContain('Prolink');
    expect(TERMO_INTRODUCAO.length).toBeGreaterThan(0);
    expect(TERMO_ITENS).toHaveLength(4);
    expect(TERMO_FINALIDADE).toContain('Finalidade');
    expect(TERMO_RETENCAO).toContain('Retenção');
    expect(TERMO_BASE_LEGAL).toContain('LGPD');
  });

  it('expõe o label do checkbox e a mensagem de recusa', () => {
    expect(TERMO_CHECKBOX_LABEL.length).toBeGreaterThan(0);
    expect(TERMO_RECUSA_MENSAGEM).toContain('não conseguimos processar');
    expect(TERMO_CONTATO_EMAIL).toContain('@');
  });
});