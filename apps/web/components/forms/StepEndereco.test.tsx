import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import StepEndereco from '@/components/forms/StepEndereco';
import { server } from '@/mocks/server';
import { lerEstado, renderStep } from '@/mocks/form-harness';

const VIACEP_URL = 'https://viacep.com.br/ws/:cep/json/';

const defaultValues = {
  endereco: {
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    municipio: '',
    estado: '',
    iptu: '',
    imovelAlugado: false,
  },
};

describe('StepEndereco', () => {
  it('renderiza sem endereço inicial (campos vazios)', () => {
    renderStep(<StepEndereco />, { defaultValues: {} });

    expect(screen.getByPlaceholderText('00000-000')).toHaveValue('');
    expect(screen.getByPlaceholderText('Obrigatório')).toHaveValue('');
  });

  it('preenche o endereço automaticamente a partir do CEP e desabilita os campos', async () => {
    renderStep(<StepEndereco />, { defaultValues });

    await userEvent.type(screen.getByPlaceholderText('00000-000'), '01310100');

    await waitFor(() =>
      expect(screen.getByDisplayValue('Avenida Paulista')).toBeInTheDocument()
    );
    expect(screen.getByDisplayValue('Avenida Paulista')).toBeDisabled();
    expect(screen.getByDisplayValue('Bela Vista')).toBeDisabled();
    expect(screen.getByDisplayValue('São Paulo')).toBeDisabled();
    expect(screen.getByDisplayValue('SP')).toBeDisabled();
  });

  it('mostra o estado de carregamento enquanto o ViaCEP responde', async () => {
    server.use(
      http.get(VIACEP_URL, async () => {
        await delay(150);
        return HttpResponse.json({
          logradouro: 'Rua A',
          bairro: 'Centro',
          localidade: 'Niterói',
          uf: 'RJ',
        });
      })
    );
    renderStep(<StepEndereco />, { defaultValues });

    await userEvent.type(screen.getByPlaceholderText('00000-000'), '24020000');

    expect(await screen.findByText('Buscando endereço...')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByDisplayValue('Rua A')).toBeInTheDocument());
  });

  it('mostra o erro quando o CEP não é encontrado', async () => {
    server.use(http.get(VIACEP_URL, () => HttpResponse.json({ erro: true })));
    renderStep(<StepEndereco />, { defaultValues });

    await userEvent.type(screen.getByPlaceholderText('00000-000'), '99999999');

    expect(await screen.findByText('CEP não encontrado.')).toBeInTheDocument();
  });

  it('preenche manualmente número, complemento e IPTU', async () => {
    renderStep(<StepEndereco />, { defaultValues });

    await userEvent.type(screen.getByPlaceholderText('Obrigatório'), '1-2-3-4');
    await userEvent.type(screen.getByPlaceholderText('S/N'), '100');
    await userEvent.type(screen.getByPlaceholderText('Ex: Sala 1, Andar 2'), 'Sala 5');

    const estado = lerEstado();
    expect(estado.endereco.iptu).toBe('1-2-3-4');
    expect(estado.endereco.numero).toBe('100');
    expect(estado.endereco.complemento).toBe('Sala 5');
  });

  it('alterna entre imóvel próprio e alugado', async () => {
    renderStep(<StepEndereco />, { defaultValues });

    await userEvent.click(screen.getByText('Sim — Alugado'));
    expect(lerEstado().endereco.imovelAlugado).toBe(true);

    await userEvent.click(screen.getByText('Não — Próprio / Cedido'));
    expect(lerEstado().endereco.imovelAlugado).toBe(false);
  });
});