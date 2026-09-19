import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Q05CapitalSocial from '@/components/forms-alteracao/quadros/Q05CapitalSocial';
import { lerEstadoAlteracao, renderAlteracao } from '@/mocks/alteracao-harness';

const defaultValues = {
  q05: {
    valorCapitalSocial: 0,
    tipoAlteracao: 'aumento' as const,
    valorIntegralizacao: undefined,
    especificarIntegralizacao: '',
  },
};

describe('Q05CapitalSocial', () => {
  it('mostra os campos de integralização no aumento e esconde na redução', async () => {
    renderAlteracao(<Q05CapitalSocial />, { defaultValues });

    expect(screen.getByText('Valor da Integralização')).toBeInTheDocument();
    expect(screen.getByText('Forma da Integralização')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Redução'));
    expect(lerEstadoAlteracao().q05?.tipoAlteracao).toBe('reducao');
    expect(screen.queryByText('Valor da Integralização')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Aumento'));
    expect(screen.getByText('Valor da Integralização')).toBeInTheDocument();
  });

  it('preenche os valores em moeda e a forma de integralização', async () => {
    renderAlteracao(<Q05CapitalSocial />, { defaultValues });

    const moedas = screen.getAllByPlaceholderText('R$ 0,00');
    await userEvent.type(moedas[0], '50000');
    await userEvent.type(moedas[1], '10000');
    await userEvent.type(
      screen.getByPlaceholderText('Especifique a forma de integralização...'),
      'Em dinheiro'
    );

    const q05 = lerEstadoAlteracao().q05;
    expect(q05?.valorCapitalSocial).toBe(50000);
    expect(q05?.valorIntegralizacao).toBe(10000);
    expect(q05?.especificarIntegralizacao).toBe('Em dinheiro');

    await userEvent.clear(moedas[0]);
    expect(lerEstadoAlteracao().q05?.valorCapitalSocial).toBe(0);
  });
});