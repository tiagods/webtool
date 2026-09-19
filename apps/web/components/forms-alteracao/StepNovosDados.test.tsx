import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import StepNovosDados from '@/components/forms-alteracao/StepNovosDados';
import { renderAlteracao } from '@/mocks/alteracao-harness';

describe('StepNovosDados', () => {
  it('renderiza apenas os quadros selecionados, na ordem canônica', () => {
    renderAlteracao(<StepNovosDados />, {
      defaultValues: { quadros: ['objeto_social', 'nome_empresarial'] },
    });

    expect(screen.getByText('Q01 — Razão Social')).toBeInTheDocument();
    expect(screen.getByText('Q02 — Objeto Social')).toBeInTheDocument();
    expect(screen.queryByText('Q03 — Mudança de Endereço da Sede')).not.toBeInTheDocument();
  });

  it('não renderiza quadro nenhum quando a lista é vazia/ausente', () => {
    renderAlteracao(<StepNovosDados />, { defaultValues: {} });

    expect(screen.queryByText(/^Q0/)).not.toBeInTheDocument();
  });
});