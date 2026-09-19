import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import StepIdentificacao from '@/components/forms-alteracao/StepIdentificacao';
import { server } from '@/mocks/server';
import { lerEstadoAlteracao, renderAlteracao } from '@/mocks/alteracao-harness';

const VIACEP_URL = 'https://viacep.com.br/ws/:cep/json/';

const defaultValues = {
  identificacao: {
    cnpj: '',
    razaoSocial: '',
    nomeFantasia: '',
    tipoConstituicao: 'ltda' as const,
    enderecoAtual: { logradouro: '', bairro: '', municipio: '', estado: '', cep: '' },
    situacao: 'ativa' as const,
  },
};

describe('StepIdentificacao (alteração)', () => {
  it('renderiza os campos de identificação', () => {
    renderAlteracao(<StepIdentificacao />, { defaultValues });

    expect(screen.getByText('CNPJ')).toBeInTheDocument();
    expect(screen.getByText('Razão Social')).toBeInTheDocument();
    expect(screen.getByText('Tipo de Constituição Atual')).toBeInTheDocument();
    expect(screen.getByText('Situação Cadastral')).toBeInTheDocument();
  });

  it('aplica a máscara de CNPJ e preenche razão e fantasia', async () => {
    renderAlteracao(<StepIdentificacao />, { defaultValues });

    await userEvent.type(screen.getByPlaceholderText('00.000.000/0000-00'), '11222333000181');
    await userEvent.type(screen.getByPlaceholderText('Razão social atual'), 'Alpha Ltda');
    await userEvent.type(
      screen.getByPlaceholderText('Como a empresa é conhecida'),
      'Alpha'
    );

    const identificacao = lerEstadoAlteracao().identificacao;
    expect(identificacao?.cnpj).toBe('11.222.333/0001-81');
    expect(identificacao?.razaoSocial).toBe('Alpha Ltda');
    expect(identificacao?.nomeFantasia).toBe('Alpha');
  });

  it('preenche o endereço atual pelo CEP', async () => {
    renderAlteracao(<StepIdentificacao />, { defaultValues });

    await userEvent.type(screen.getByPlaceholderText('00000-000'), '01310100');

    await waitFor(() =>
      expect(screen.getByDisplayValue('Avenida Paulista')).toBeInTheDocument()
    );
    expect(screen.getByDisplayValue('Avenida Paulista')).toBeDisabled();
  });

  it('mostra o carregamento e depois o erro do ViaCEP', async () => {
    server.use(
      http.get(VIACEP_URL, async () => {
        await delay(150);
        return HttpResponse.json({ erro: true });
      })
    );
    renderAlteracao(<StepIdentificacao />, { defaultValues });

    await userEvent.type(screen.getByPlaceholderText('00000-000'), '99999999');

    expect(await screen.findByText('Buscando endereço...')).toBeInTheDocument();
    expect(await screen.findByText('CEP não encontrado.')).toBeInTheDocument();
  });

  it('avisa quando a situação não é ativa', async () => {
    renderAlteracao(<StepIdentificacao />, { defaultValues });

    await userEvent.click(screen.getByText('Inapta'));

    expect(
      screen.getByText(/INAPTA não podem prosseguir com a alteração contratual/)
    ).toBeInTheDocument();
    expect(lerEstadoAlteracao().identificacao?.situacao).toBe('inapta');
  });

  it('troca o tipo de constituição', async () => {
    renderAlteracao(<StepIdentificacao />, { defaultValues });

    await userEvent.click(screen.getByText('Sociedade Unipessoal'));
    expect(lerEstadoAlteracao().identificacao?.tipoConstituicao).toBe('slu');

    await userEvent.click(screen.getByText('Sociedade Limitada'));
    expect(lerEstadoAlteracao().identificacao?.tipoConstituicao).toBe('ltda');
  });

  it('troca a situação cadastral entre ativa, inapta e baixada', async () => {
    renderAlteracao(<StepIdentificacao />, { defaultValues });

    await userEvent.click(screen.getByText('Baixada'));
    expect(lerEstadoAlteracao().identificacao?.situacao).toBe('baixada');

    await userEvent.click(screen.getByText('Ativa'));
    expect(lerEstadoAlteracao().identificacao?.situacao).toBe('ativa');
  });

  it('renderiza sem identificação inicial', () => {
    renderAlteracao(<StepIdentificacao />, { defaultValues: {} });

    expect(screen.getByPlaceholderText('00.000.000/0000-00')).toHaveValue('');
    expect(screen.getByPlaceholderText('00000-000')).toHaveValue('');
  });
});