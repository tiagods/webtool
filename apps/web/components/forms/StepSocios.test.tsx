import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StepSocios from '@/components/forms/StepSocios';
import { lerEstado, renderStep } from '@/mocks/form-harness';

function socio(overrides: Record<string, unknown> = {}) {
  return {
    nome: 'Ana Souza',
    pis: '',
    profissao: 'Analista',
    proLabore: 0,
    telefoneCelular: '',
    telefoneFixo: '',
    email: '',
    estadoCivil: 'solteiro' as const,
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