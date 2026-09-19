import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StepSociedade from '@/components/forms/StepSociedade';
import { lerEstado, renderStep } from '@/mocks/form-harness';

function socio(nome: string) {
  return {
    nome,
    pis: '',
    cpf: '',
    rg: '',
    nacionalidade: '',
    profissao: 'Analista',
    proLabore: 2000,
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
  };
}

const doisSocios = { dadosSocios: { socios: [socio('Ana Souza'), socio('Bia Lima')] } };

describe('StepSociedade', () => {
  it('lida com ausência de sócios e reconstrói as quotas', async () => {
    renderStep(<StepSociedade />, {
      defaultValues: {
        sociedade: {
          capitalSocial: 0,
          quotas: [{ percentual: 100, isAdministrador: true }],
          tipoAdministracao: 'isoladamente',
          banco: 'Itaú',
        },
      },
    });

    await waitFor(() => expect(screen.queryByPlaceholderText('50')).not.toBeInTheDocument());
    expect(screen.getByText(/Soma: 0\.00%/)).toBeInTheDocument();
  });

  it('usa fallback de nome do sócio e reconhece quota não numérica', async () => {
    renderStep(<StepSociedade />, {
      defaultValues: { dadosSocios: { socios: [socio('')] } },
    });

    await waitFor(() => expect(screen.getByText(/Soma: 100\.00%/)).toBeInTheDocument());
    expect(screen.getAllByText('Sócio 1').length).toBeGreaterThanOrEqual(1);

    const capital = screen.getByPlaceholderText('R$ 0,00');
    await userEvent.type(capital, '10000');
    expect(lerEstado().sociedade?.capitalSocial).toBe(10000);

    await userEvent.clear(capital);
    expect(lerEstado().sociedade?.capitalSocial).toBe(0);

    await userEvent.click(screen.getByText('Isoladamente'));
    expect(lerEstado().sociedade?.tipoAdministracao).toBe('isoladamente');

    await userEvent.click(screen.getByText('Outras'));
    expect(lerEstado().sociedade?.tipoAdministracao).toBe('outras');
  });

  it('cria as quotas iniciais a partir dos sócios (50/50)', async () => {
    renderStep(<StepSociedade />, { defaultValues: doisSocios });

    expect(screen.getAllByText('Ana Souza').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Bia Lima').length).toBeGreaterThanOrEqual(1);

    const percentuais = screen.getAllByPlaceholderText('50');
    expect(percentuais).toHaveLength(2);
    for (const input of percentuais) {
      expect(input).toHaveValue(50);
    }
    expect(screen.getByText(/Soma: 100\.00%/)).toBeInTheDocument();
  });

  it('avisa quando a soma das quotas não fecha 100%', async () => {
    renderStep(<StepSociedade />, { defaultValues: doisSocios });

    await waitFor(() => expect(screen.getByText(/Soma: 100\.00%/)).toBeInTheDocument());

    const percentuais = screen.getAllByPlaceholderText('50');
    await userEvent.clear(percentuais[0]);
    await userEvent.type(percentuais[0], '40');

    await waitFor(() => expect(screen.getByText(/Soma: 90\.00%/)).toBeInTheDocument());
    expect(screen.getByText(/Soma: 90\.00%/).className).toContain('text-destructive');
  });

  it('alterna o administrador de cada sócio', async () => {
    renderStep(<StepSociedade />, { defaultValues: doisSocios });

    await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(2));

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toHaveAttribute('data-state', 'checked');

    await userEvent.click(checkboxes[1]);
    expect(lerEstado().sociedade?.quotas?.[1]?.isAdministrador).toBe(true);
  });

  it('preenche o capital social formatado em moeda', async () => {
    renderStep(<StepSociedade />, { defaultValues: doisSocios });

    await userEvent.type(screen.getByPlaceholderText('R$ 0,00'), '50000');

    expect(lerEstado().sociedade?.capitalSocial).toBe(50000);
  });

  it('escolhe o tipo de administração e o banco', async () => {
    renderStep(<StepSociedade />, { defaultValues: doisSocios });

    await userEvent.click(screen.getByText('Conjunta'));
    expect(lerEstado().sociedade?.tipoAdministracao).toBe('conjunta');

    await userEvent.type(
      screen.getByPlaceholderText('Ex: Itaú, Banco do Brasil...'),
      'Banco do Brasil'
    );
    expect(lerEstado().sociedade?.banco).toBe('Banco do Brasil');
  });
});