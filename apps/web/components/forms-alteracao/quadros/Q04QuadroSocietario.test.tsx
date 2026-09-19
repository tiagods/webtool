import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import Q04QuadroSocietario from '@/components/forms-alteracao/quadros/Q04QuadroSocietario';
import { server } from '@/mocks/server';
import { lerEstadoAlteracao, renderAlteracao } from '@/mocks/alteracao-harness';

function membro(overrides: Record<string, unknown> = {}) {
  return {
    nomeCompleto: '',
    naturalidade: '',
    estadoNaturalidade: '',
    profissao: '',
    rg: '',
    digitoRg: '',
    orgaoExpedidor: '',
    estadoExpedidor: '',
    cpf: '',
    dataExpedicaoRg: '',
    dataNascimento: '',
    pis: '',
    logradouro: '',
    numero: '',
    bairro: '',
    municipio: '',
    estado: '',
    cep: '',
    telefoneResidencial: '',
    telefoneComercial: '',
    ramal: '',
    celular: '',
    email: '',
    recados: '',
    nomeMae: '',
    nomePai: '',
    participacaoAnterior: 'nao' as const,
    cnpjAnterior: '',
    percentualParticipacao: 0,
    valorParticipacao: 0,
    estadoCivil: 'solteiro' as const,
    tipo: 'cedente' as const,
    ...overrides,
  };
}

describe('Q04QuadroSocietario', () => {
  it('começa vazio, só com os botões de adicionar', () => {
    renderAlteracao(<Q04QuadroSocietario />, { defaultValues: { q04: { membros: [] } } });

    expect(screen.getByText('Adicionar cedente (sai)')).toBeInTheDocument();
    expect(screen.getByText('Adicionar cessionário (entra)')).toBeInTheDocument();
    expect(screen.queryByText('Este sócio está saindo ou entrando?')).not.toBeInTheDocument();
  });

  it('adiciona um cedente, preenche dados e mostra o CNPJ de participação anterior', async () => {
    renderAlteracao(<Q04QuadroSocietario />, { defaultValues: { q04: { membros: [] } } });

    await userEvent.click(screen.getByText('Adicionar cedente (sai)'));

    expect(screen.getByText('Sócio 1')).toBeInTheDocument();
    expect(screen.queryByText('Dados do Cessionário')).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Nome Completo'), 'Ana Souza');
    await userEvent.type(screen.getByLabelText('CPF'), '12345678909');
    await userEvent.click(screen.getByText('Casado(a) - C. Parcial'));
    await userEvent.click(screen.getByText('Sim'));

    const cnpj = await screen.findByLabelText(/CNPJ da empresa anterior/);
    await userEvent.type(cnpj, '11222333000181');

    const q04 = lerEstadoAlteracao().q04;
    expect(q04?.membros[0]).toMatchObject({
      nomeCompleto: 'Ana Souza',
      cpf: '123.456.789-09',
      estadoCivil: 'casado_comunhao_parcial',
      participacaoAnterior: 'sim',
      cnpjAnterior: '11.222.333/0001-81',
    });
  });

  it('adiciona um cessionário e alterna para cedente', async () => {
    renderAlteracao(<Q04QuadroSocietario />, {
      defaultValues: { q04: { membros: [membro({ nomeCompleto: 'Ana' })] } },
    });

    await userEvent.click(screen.getByText('Adicionar cessionário (entra)'));

    expect(screen.getByText('Sócio 2')).toBeInTheDocument();
    expect(screen.getByText('Dados do Cessionário')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Valor do Pró-Labore (R$)'), '4500');
    expect(lerEstadoAlteracao().q04?.membros[1].proLabore).toBe(4500);

    await userEvent.clear(screen.getByLabelText('Valor do Pró-Labore (R$)'));
    expect(lerEstadoAlteracao().q04?.membros[1].proLabore).toBe(0);

    await userEvent.click(screen.getByText('Cedente (sai)'));
    expect(screen.queryByText('Dados do Cessionário')).not.toBeInTheDocument();
  });

  it('troca de aba e remove um sócio', async () => {
    renderAlteracao(<Q04QuadroSocietario />, {
      defaultValues: {
        q04: { membros: [membro({ nomeCompleto: 'Ana' }), membro({ nomeCompleto: 'Bia', tipo: 'cessionario', socioAdministrador: '', proLabore: 0 })] },
      },
    });

    await userEvent.click(screen.getByText('Sócio 2'));
    await userEvent.click(screen.getByTitle('Remover'));

    await waitFor(() => expect(screen.queryByText('Sócio 2')).not.toBeInTheDocument());
  });

  it('preenche o endereço do membro pelo CEP', async () => {
    renderAlteracao(<Q04QuadroSocietario />, {
      defaultValues: { q04: { membros: [membro()] } },
    });

    await userEvent.type(screen.getByPlaceholderText('00000-000'), '01310100');

    await waitFor(() =>
      expect(screen.getByDisplayValue('Avenida Paulista')).toBeInTheDocument()
    );
  });

  it('mostra o erro do ViaCEP no endereço do membro', async () => {
    server.use(
      http.get('https://viacep.com.br/ws/:cep/json/', () => HttpResponse.json({ erro: true }))
    );
    renderAlteracao(<Q04QuadroSocietario />, {
      defaultValues: { q04: { membros: [membro()] } },
    });

    await userEvent.type(screen.getByPlaceholderText('00000-000'), '99999999');

    expect(await screen.findByText('CEP não encontrado.')).toBeInTheDocument();
  });

  it('mostra os erros de raiz e da lista de membros', async () => {
    renderAlteracao(<Q04QuadroSocietario />, {
      defaultValues: { q04: { membros: [] } },
      onReady: (methods) =>
        methods.setError('q04.membros.root', { type: 'manual', message: 'Erro raiz q04' }),
    });

    expect(await screen.findByText('Erro raiz q04')).toBeInTheDocument();
  });

  it('mostra o erro direto da lista de membros', async () => {
    renderAlteracao(<Q04QuadroSocietario />, {
      defaultValues: { q04: { membros: [] } },
      onReady: (methods) =>
        methods.setError('q04.membros', { type: 'manual', message: 'Erro lista q04' }),
    });

    expect(await screen.findByText('Erro lista q04')).toBeInTheDocument();
  });

  it('renderiza sem q04 inicial', () => {
    renderAlteracao(<Q04QuadroSocietario />, { defaultValues: {} });

    expect(screen.getByText('Adicionar cedente (sai)')).toBeInTheDocument();
  });

  it('cobre campos ausentes do membro e preenche as máscaras', async () => {
    renderAlteracao(<Q04QuadroSocietario />, {
      defaultValues: {
        q04: {
          membros: [
            membro({
              cpf: undefined,
              pis: undefined,
              celular: undefined,
              cep: undefined,
              valorParticipacao: undefined,
              cnpjAnterior: undefined,
              participacaoAnterior: 'sim',
            }),
          ],
        },
      },
    });

    expect(screen.getByPlaceholderText('00000-000')).toHaveValue('');
    expect(screen.getByPlaceholderText('000.00000.00-0')).toHaveValue('');
    expect(screen.getByPlaceholderText('(00) 00000-0000')).toHaveValue('');
    expect(screen.getByPlaceholderText('00.000.000/0000-00')).toHaveValue('');
    expect(screen.getByPlaceholderText('R$ 0,00')).toHaveValue('');

    await userEvent.type(screen.getByPlaceholderText('000.00000.00-0'), '12345678901');
    await userEvent.type(screen.getByPlaceholderText('(00) 00000-0000'), '11999991234');
    await userEvent.type(screen.getByLabelText('Percentual de Participação (%)'), '50');
    await userEvent.type(screen.getByPlaceholderText('R$ 0,00'), '25000');

    const primeiro = lerEstadoAlteracao().q04?.membros[0];
    expect(primeiro?.pis).toBe('123.45678.90-1');
    expect(primeiro?.celular).toBe('(11) 99999-1234');
    expect(primeiro?.percentualParticipacao).toBe(50);
    expect(primeiro?.valorParticipacao).toBe(25000);

    await userEvent.clear(screen.getByPlaceholderText('R$ 0,00'));
    expect(lerEstadoAlteracao().q04?.membros[0].valorParticipacao).toBe(0);

    await userEvent.click(screen.getByText('Não'));
    expect(lerEstadoAlteracao().q04?.membros[0].participacaoAnterior).toBe('nao');
    expect(screen.queryByPlaceholderText('00.000.000/0000-00')).not.toBeInTheDocument();
  });

  it('alterna o tipo do cessionário e o sócio administrador', async () => {
    renderAlteracao(<Q04QuadroSocietario />, {
      defaultValues: {
        q04: {
          membros: [membro({ tipo: 'cessionario', socioAdministrador: '', proLabore: 0 })],
        },
      },
    });

    await userEvent.click(screen.getByText('Cessionário (entra)'));
    expect(lerEstadoAlteracao().q04?.membros[0].socioAdministrador).toBe('');

    const sims = screen.getAllByText('Sim');
    await userEvent.click(sims[sims.length - 1]);
    expect(lerEstadoAlteracao().q04?.membros[0].socioAdministrador).toBe('sim');

    const naos = screen.getAllByText('Não');
    await userEvent.click(naos[naos.length - 1]);
    expect(lerEstadoAlteracao().q04?.membros[0].socioAdministrador).toBe('nao');
  });
});