import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import StepSocios from '@/components/forms/StepSocios';
import { server } from '@/mocks/server';
import { lerEstado, renderStep } from '@/mocks/form-harness';

function socio(overrides: Record<string, unknown> = {}) {
  return {
    nome: 'Ana Souza',
    pis: '',
    cpf: '',
    rg: '',
    nacionalidade: '',
    profissao: 'Analista',
    proLabore: 0,
    telefoneCelular: '',
    telefoneFixo: '',
    email: '',
    estadoCivil: 'solteiro' as const,
    nomeMae: '',
    nomePai: '',
    cepRegistro: '',
    logradouroRegistro: '',
    numeroRegistro: '',
    complementoRegistro: '',
    bairroRegistro: '',
    teveParticipacaoSocietaria: false,
    cnpjParticipacao: '',
    ...overrides,
  };
}

const doisSocios = {
  dadosSocios: { socios: [socio({ nome: 'Ana Souza' }), socio({ nome: 'Bia Lima' })] },
};

describe('StepSocios', () => {
  it('cobre campos crus, troca de aba e chips de estado civil', async () => {
    renderStep(<StepSocios isSlu={false} />, {
      defaultValues: {
        dadosSocios: {
          socios: [
            socio({
              nome: 'Ana',
              cepRegistro: undefined,
              cpf: undefined,
              pis: undefined,
              telefoneCelular: undefined,
              cnpjParticipacao: undefined,
              teveParticipacaoSocietaria: true,
            }),
            socio({ nome: 'Bia' }),
          ],
        },
      },
    });

    expect(screen.getByPlaceholderText('00.000.000/0000-00')).toHaveValue('');
    expect(screen.getByPlaceholderText('00000-000')).toHaveValue('');

    await userEvent.click(screen.getByText('Sócio 2'));
    await userEvent.click(screen.getByText('Sócio 1'));

    for (const label of [
      'Solteiro(a)',
      'Casado(a) - C. Parcial',
      'Casado(a) - C. Universal',
      'Divorciado(a)/Separado',
      'Viúvo(a)',
    ]) {
      await userEvent.click(screen.getByText(label));
    }
    expect(lerEstado().dadosSocios.socios[0].estadoCivil).toBe('viuvo');

    const proLabore = screen.getByPlaceholderText('R$ 0,00');
    await userEvent.type(proLabore, '2000');
    expect(lerEstado().dadosSocios.socios[0].proLabore).toBe(2000);

    await userEvent.clear(proLabore);
    expect(lerEstado().dadosSocios.socios[0].proLabore).toBe(0);
  });

  it('mostra as abas dos sócios e permite remover e adicionar (Ltda)', async () => {
    renderStep(<StepSocios isSlu={false} />, { defaultValues: doisSocios });

    expect(screen.getByText('Sócio 1')).toBeInTheDocument();
    expect(screen.getByText('Sócio 2')).toBeInTheDocument();

    await userEvent.click(screen.getByTitle('Remover sócio'));
    await waitFor(() => expect(screen.queryByText('Sócio 2')).not.toBeInTheDocument());

    await userEvent.click(screen.getByText('Adicionar outro sócio'));
    await waitFor(() => expect(screen.getByText('Sócio 2')).toBeInTheDocument());
  });

  it('não permite remover nem adicionar no fluxo SLU', () => {
    renderStep(<StepSocios isSlu />, { defaultValues: { dadosSocios: { socios: [socio()] } } });

    expect(screen.queryByTitle('Remover sócio')).not.toBeInTheDocument();
    expect(screen.queryByText('Adicionar outro sócio')).not.toBeInTheDocument();
  });

  it('usa fallback de nome quando o sócio não tem nome', () => {
    renderStep(<StepSocios isSlu={false} />, {
      defaultValues: { dadosSocios: { socios: [socio({ nome: '' }), socio({ nome: '' })] } },
    });

    expect(screen.getByText('Sócio 1')).toBeInTheDocument();
  });

  it('mostra o campo de CNPJ quando o sócio já participou de outra empresa', async () => {
    renderStep(<StepSocios isSlu={false} />, { defaultValues: doisSocios });

    expect(screen.queryByPlaceholderText('00.000.000/0000-00')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Sim'));

    const cnpj = await screen.findByPlaceholderText('00.000.000/0000-00');
    await userEvent.type(cnpj, '12345678000199');
    expect(lerEstado().dadosSocios.socios[0].cnpjParticipacao).toBe('12.345.678/0001-99');

    await userEvent.click(screen.getAllByText('Não')[0]);
    expect(screen.queryByPlaceholderText('00.000.000/0000-00')).not.toBeInTheDocument();
  });

  it('aplica as máscaras de CPF, PIS, celular e pró-labore', async () => {
    renderStep(<StepSocios isSlu={false} />, { defaultValues: doisSocios });

    await userEvent.type(screen.getByPlaceholderText('000.000.000-00'), '12345678909');
    await userEvent.type(screen.getByPlaceholderText('000.00000.00-0'), '12345678901');
    await userEvent.type(screen.getByPlaceholderText('(00) 00000-0000'), '11999991234');
    await userEvent.type(screen.getByPlaceholderText('R$ 0,00'), '4500');

    const primeiro = lerEstado().dadosSocios.socios[0];
    expect(primeiro.cpf).toBe('123.456.789-09');
    expect(primeiro.pis).toBe('123.45678.90-1');
    expect(primeiro.telefoneCelular).toBe('(11) 99999-1234');
    expect(primeiro.proLabore).toBe(4500);
  });

  it('preenche o endereço do sócio pelo CEP', async () => {
    renderStep(<StepSocios isSlu={false} />, { defaultValues: doisSocios });

    await userEvent.type(screen.getByPlaceholderText('00000-000'), '01310100');

    await waitFor(() =>
      expect(screen.getByDisplayValue('Avenida Paulista')).toBeInTheDocument()
    );
    expect(screen.getByDisplayValue('Avenida Paulista')).toBeDisabled();
  });

  it('mostra o erro do ViaCEP no endereço do sócio', async () => {
    server.use(
      http.get('https://viacep.com.br/ws/:cep/json/', () => HttpResponse.json({ erro: true }))
    );
    renderStep(<StepSocios isSlu={false} />, { defaultValues: doisSocios });

    await userEvent.type(screen.getByPlaceholderText('00000-000'), '99999999');

    expect(await screen.findByText('CEP não encontrado.')).toBeInTheDocument();
  });

  it('mostra o erro de raiz da lista de sócios', async () => {
    renderStep(<StepSocios isSlu={false} />, {
      defaultValues: doisSocios,
      onReady: (methods) =>
        methods.setError('dadosSocios.socios.root', { type: 'manual', message: 'Erro raiz' }),
    });

    expect(await screen.findByText('Erro raiz')).toBeInTheDocument();
  });

  it('mostra o erro direto da lista de sócios', async () => {
    renderStep(<StepSocios isSlu={false} />, {
      defaultValues: doisSocios,
      onReady: (methods) =>
        methods.setError('dadosSocios.socios', { type: 'manual', message: 'Erro lista' }),
    });

    expect(await screen.findByText('Erro lista')).toBeInTheDocument();
  });
});