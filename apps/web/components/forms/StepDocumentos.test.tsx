import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StepDocumentos from '@/components/forms/StepDocumentos';
import { lerEstado, renderStep } from '@/mocks/form-harness';

function socio(overrides: Record<string, unknown>) {
  return {
    nome: 'Ana Souza',
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
    ...overrides,
  };
}

const comParticipacao = {
  endereco: { imovelAlugado: true },
  dadosSocios: {
    socios: [
      socio({ nome: 'Ana Souza', estadoCivil: 'casado_comunhao_parcial', profissao: 'Advogada' }),
      socio({ nome: 'Bia Lima', estadoCivil: 'solteiro', profissao: 'Analista' }),
    ],
  },
};

function arquivo() {
  return new File(['conteudo'], 'doc.pdf', { type: 'application/pdf' });
}

describe('StepDocumentos', () => {
  it('renderiza sem sócios nem endereço (fallbacks)', async () => {
    renderStep(<StepDocumentos />, { defaultValues: {} });

    expect(screen.getByText('Imóvel')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Imóvel'));

    expect(screen.getByText('Cópia do IPTU')).toBeInTheDocument();
    expect(screen.getByText(/Imóvel próprio\/cedido/)).toBeInTheDocument();
  });

  it('abre na aba do primeiro sócio com os documentos condicionais', () => {
    renderStep(<StepDocumentos />, { defaultValues: comParticipacao });

    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('Certidão de Casamento')).toBeInTheDocument();
    expect(screen.getByText('Registro em Conselho Profissional')).toBeInTheDocument();
  });

  it('não pede certidão nem conselho para sócio solteiro sem conselho', async () => {
    renderStep(<StepDocumentos />, { defaultValues: comParticipacao });

    await userEvent.click(screen.getByText('Bia'));

    expect(screen.getByText('Bia Lima')).toBeInTheDocument();
    expect(screen.queryByText('Certidão de Casamento')).not.toBeInTheDocument();
    expect(screen.queryByText('Registro em Conselho Profissional')).not.toBeInTheDocument();
  });

  it('aba do imóvel alugado pede IPTU e contrato de locação', async () => {
    renderStep(<StepDocumentos />, { defaultValues: comParticipacao });

    await userEvent.click(screen.getByText('Imóvel'));

    expect(screen.getByText('Cópia do IPTU')).toBeInTheDocument();
    expect(screen.getByText('Contrato de Locação')).toBeInTheDocument();
  });

  it('imóvel próprio não pede contrato e avisa para alterar no passo 2', async () => {
    renderStep(<StepDocumentos />, {
      defaultValues: {
        endereco: { imovelAlugado: false },
        dadosSocios: { socios: [socio({})] },
      },
    });

    await userEvent.click(screen.getByText('Imóvel'));

    expect(screen.getByText('Cópia do IPTU')).toBeInTheDocument();
    expect(screen.queryByText('Contrato de Locação')).not.toBeInTheDocument();
    expect(screen.getByText(/Imóvel próprio\/cedido/)).toBeInTheDocument();
  });

  it('usa fallback de nome do sócio na aba e no conteúdo', () => {
    renderStep(<StepDocumentos />, {
      defaultValues: {
        endereco: { imovelAlugado: false },
        dadosSocios: { socios: [socio({ nome: '' })] },
      },
    });

    expect(screen.getAllByText('Sócio 1').length).toBeGreaterThanOrEqual(2);
  });

  it('conta os enviados por aba ao subir e remover arquivo', async () => {
    const { container } = renderStep(<StepDocumentos />, { defaultValues: comParticipacao });

    await userEvent.click(screen.getByText('Imóvel'));

    expect(container.querySelectorAll('input[type="file"]').length).toBe(2);

    fireEvent.change(container.querySelectorAll('input[type="file"]')[0], {
      target: { files: [arquivo()] },
    });

    expect(await screen.findByText('Enviado ✓')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('1/2')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Remover arquivo' }));
    await waitFor(() => expect(screen.getByText('0/2')).toBeInTheDocument());
    expect(lerEstado().endereco?.imovelAlugado).toBe(true);

    fireEvent.change(container.querySelectorAll('input[type="file"]')[0], {
      target: { files: [arquivo()] },
    });
    await waitFor(() => expect(screen.getByText('1/2')).toBeInTheDocument());

    fireEvent.change(container.querySelectorAll('input[type="file"]')[0], {
      target: { files: [arquivo()] },
    });
    await waitFor(() => expect(screen.getByText('2/2')).toBeInTheDocument());

    await userEvent.click(screen.getByText('Ana'));

    expect(container.querySelectorAll('input[type="file"]').length).toBeGreaterThan(0);
    fireEvent.change(container.querySelectorAll('input[type="file"]')[0], {
      target: { files: [arquivo()] },
    });
    await waitFor(() => expect(screen.getByText('1/9')).toBeInTheDocument());
  });
});