import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Q06Redistribuicao from '@/components/forms-alteracao/quadros/Q06Redistribuicao';
import { lerEstadoAlteracao, renderAlteracao } from '@/mocks/alteracao-harness';

describe('Q06Redistribuicao', () => {
  it('adiciona, preenche e remove sócios', async () => {
    renderAlteracao(<Q06Redistribuicao />, { defaultValues: { q06: { socios: [] } } });

    await userEvent.click(screen.getByText('Adicionar sócio'));

    await userEvent.type(screen.getByRole('textbox'), 'Ana Souza');
    const spinbuttons = screen.getAllByRole('spinbutton');
    await userEvent.type(spinbuttons[0], '50');
    await userEvent.type(spinbuttons[1], '25000');

    let socios = lerEstadoAlteracao().q06?.socios;
    expect(socios?.[0]).toMatchObject({ nomeSocio: 'Ana Souza', percentual: 50, valor: 25000 });

    await userEvent.click(screen.getByTitle('Remover'));

    socios = lerEstadoAlteracao().q06?.socios;
    expect(socios).toHaveLength(0);
  });
});