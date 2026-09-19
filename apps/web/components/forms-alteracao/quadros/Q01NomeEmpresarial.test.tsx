import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Q01NomeEmpresarial from '@/components/forms-alteracao/quadros/Q01NomeEmpresarial';
import { lerEstadoAlteracao, renderAlteracao } from '@/mocks/alteracao-harness';

describe('Q01NomeEmpresarial', () => {
  it('preenche as três opções de razão social', async () => {
    renderAlteracao(<Q01NomeEmpresarial />, {
      defaultValues: { q01: { nomeEmpresarial1: '', nomeEmpresarial2: '', nomeEmpresarial3: '' } },
    });

    await userEvent.type(screen.getByPlaceholderText('Ex: João da Silva Serviços Ltda'), 'Alfa Ltda');
    await userEvent.type(
      screen.getByPlaceholderText('Ex: Silva & Associados Serviços Ltda'),
      'Beta Ltda'
    );
    await userEvent.type(
      screen.getByPlaceholderText('Ex: JS Consultoria e Serviços Ltda'),
      'Gama Ltda'
    );

    expect(lerEstadoAlteracao().q01).toEqual({
      nomeEmpresarial1: 'Alfa Ltda',
      nomeEmpresarial2: 'Beta Ltda',
      nomeEmpresarial3: 'Gama Ltda',
    });
  });
});