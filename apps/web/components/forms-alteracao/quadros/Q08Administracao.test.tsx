import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Q08Administracao from '@/components/forms-alteracao/quadros/Q08Administracao';
import { lerEstadoAlteracao, renderAlteracao } from '@/mocks/alteracao-harness';

describe('Q08Administracao', () => {
  it('adiciona, preenche e remove administradores', async () => {
    renderAlteracao(<Q08Administracao />, { defaultValues: { q08: { administradores: [] } } });

    await userEvent.click(screen.getByText('Adicionar administrador'));
    await userEvent.type(screen.getByPlaceholderText('Administrador 1'), 'Ana Souza');

    expect(lerEstadoAlteracao().q08?.administradores).toEqual(['Ana Souza']);
    expect(screen.queryByTitle('Remover')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Adicionar administrador'));
    await userEvent.type(screen.getByPlaceholderText('Administrador 2'), 'Bia Lima');
    expect(lerEstadoAlteracao().q08?.administradores).toEqual(['Ana Souza', 'Bia Lima']);

    await userEvent.click(screen.getAllByTitle('Remover')[0]);

    expect(lerEstadoAlteracao().q08?.administradores).toEqual(['Bia Lima']);
  });

  it('renderiza sem q08 inicial', () => {
    renderAlteracao(<Q08Administracao />, { defaultValues: {} });

    expect(screen.getByText('Adicionar administrador')).toBeInTheDocument();
  });
});