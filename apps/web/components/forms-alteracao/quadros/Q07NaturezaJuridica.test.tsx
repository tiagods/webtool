import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Q07NaturezaJuridica from '@/components/forms-alteracao/quadros/Q07NaturezaJuridica';
import { lerEstadoAlteracao, renderAlteracao } from '@/mocks/alteracao-harness';

const defaultValues = { q07: { tipoTransformacao: 'ltda_para_simples' as const, especificar: '' } };

describe('Q07NaturezaJuridica', () => {
  it('troca o tipo de transformação e mostra o campo de especificação em "Outras"', async () => {
    renderAlteracao(<Q07NaturezaJuridica />, { defaultValues });

    expect(screen.queryByText('Especifique a Transformação')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Simples Limitada → Ltda'));
    expect(lerEstadoAlteracao().q07?.tipoTransformacao).toBe('simples_para_ltda');

    await userEvent.click(screen.getByText('Outras'));
    expect(lerEstadoAlteracao().q07?.tipoTransformacao).toBe('outras');
    expect(screen.getByText('Especifique a Transformação')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox'), 'Reorganização societária');
    expect(lerEstadoAlteracao().q07?.especificar).toBe('Reorganização societária');

    await userEvent.click(screen.getByText('Ltda → Simples Limitada'));
    expect(lerEstadoAlteracao().q07?.tipoTransformacao).toBe('ltda_para_simples');
  });
});