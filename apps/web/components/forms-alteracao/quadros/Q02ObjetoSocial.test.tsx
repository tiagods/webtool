import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Q02ObjetoSocial from '@/components/forms-alteracao/quadros/Q02ObjetoSocial';
import { lerEstadoAlteracao, renderAlteracao } from '@/mocks/alteracao-harness';

describe('Q02ObjetoSocial', () => {
  it('preenche o novo objeto social', async () => {
    renderAlteracao(<Q02ObjetoSocial />, { defaultValues: { q02: { novoObjetoSocial: '' } } });

    await userEvent.type(
      screen.getByPlaceholderText('Descreva a nova atividade com o máximo de detalhes...'),
      'Consultoria empresarial e financeira'
    );

    expect(lerEstadoAlteracao().q02?.novoObjetoSocial).toBe(
      'Consultoria empresarial e financeira'
    );
  });
});