import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Q09Outras from '@/components/forms-alteracao/quadros/Q09Outras';
import { lerEstadoAlteracao, renderAlteracao } from '@/mocks/alteracao-harness';

describe('Q09Outras', () => {
  it('preenche a descrição das outras alterações', async () => {
    renderAlteracao(<Q09Outras />, { defaultValues: { q09: { descricao: '' } } });

    await userEvent.type(
      screen.getByPlaceholderText('Descreva a alteração desejada...'),
      'Alteração de cláusula contratual'
    );

    expect(lerEstadoAlteracao().q09?.descricao).toBe('Alteração de cláusula contratual');
  });
});