import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import Q03Endereco from '@/components/forms-alteracao/quadros/Q03Endereco';
import { server } from '@/mocks/server';
import { lerEstadoAlteracao, renderAlteracao } from '@/mocks/alteracao-harness';

const defaultValues = {
  q03: {
    logradouro: '',
    bairro: '',
    municipio: '',
    estado: '',
    cep: '',
    iptu: '',
  },
};

describe('Q03Endereco', () => {
  it('preenche o endereço pelo CEP e o IPTU manualmente', async () => {
    renderAlteracao(<Q03Endereco />, { defaultValues });

    await userEvent.type(screen.getByPlaceholderText('00000-000'), '01310100');
    await userEvent.type(screen.getByPlaceholderText('Obrigatório'), '1-2-3-4');

    await waitFor(() =>
      expect(screen.getByDisplayValue('Avenida Paulista')).toBeInTheDocument()
    );
    expect(screen.getByDisplayValue('Avenida Paulista')).toBeDisabled();
    expect(lerEstadoAlteracao().q03?.iptu).toBe('1-2-3-4');
  });

  it('mostra o erro quando o CEP não é encontrado', async () => {
    server.use(
      http.get('https://viacep.com.br/ws/:cep/json/', () => HttpResponse.json({ erro: true }))
    );
    renderAlteracao(<Q03Endereco />, { defaultValues });

    await userEvent.type(screen.getByPlaceholderText('00000-000'), '99999999');

    expect(await screen.findByText('CEP não encontrado.')).toBeInTheDocument();
  });

  it('renderiza sem q03 inicial', () => {
    renderAlteracao(<Q03Endereco />, { defaultValues: {} });

    expect(screen.getByPlaceholderText('00000-000')).toHaveValue('');
  });
});