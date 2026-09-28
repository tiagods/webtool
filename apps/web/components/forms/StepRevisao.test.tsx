import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StepRevisao from '@/components/forms/StepRevisao';
import { lerEstado, renderStep } from '@/mocks/form-harness';

const preenchido = {
  dadosEmpresa: {
    tipoConstituicao: 'ltda' as const,
    nomeEmpresarial1: 'Alpha Serviços Ltda',
    nomeEmpresarial2: 'Beta Serviços Ltda',
    nomeEmpresarial3: 'Gama Serviços Ltda',
    nomeFantasia: '',
    atividade: 'Consultoria empresarial',
  },
  endereco: {
    cep: '01310-100',
    logradouro: 'Avenida Paulista',
    numero: '1374',
    complemento: '',
    bairro: 'Bela Vista',
    municipio: 'São Paulo',
    estado: 'SP',
    iptu: '1-2-3',
    imovelAlugado: 'sim',
  },
  dadosSocios: {
    socios: [
      {
        nome: 'Maria Silva',
        proLabore: 4500,
        pis: '',
        profissao: '',
        telefoneCelular: '',
        telefoneFixo: '',
        email: '',
        estadoCivil: 'solteiro' as const,
        teveParticipacaoSocietaria: false,
        cnpjParticipacao: '',
      },
    ],
  },
  documentosAceitos: false,
};

describe('StepRevisao (abertura)', () => {
  it('mostra o resumo da empresa, endereço e sócios', () => {
    renderStep(<StepRevisao />, { defaultValues: preenchido });

    expect(screen.getByText('ltda')).toBeInTheDocument();
    expect(screen.getByText('Alpha Serviços Ltda')).toBeInTheDocument();
    expect(screen.getByText('Consultoria empresarial')).toBeInTheDocument();
    expect(
      screen.getByText('Avenida Paulista, 1374 — Bela Vista, São Paulo/SP — CEP: 01310-100')
    ).toBeInTheDocument();
    expect(screen.getByText('Sócios (1)')).toBeInTheDocument();
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.getByText('Pró-labore: R$ 4500.00')).toBeInTheDocument();
  });

  it('usa placeholders quando os dados não foram informados', () => {
    renderStep(<StepRevisao />, { defaultValues: {} });

    expect(screen.getByText('Sócios (0)')).toBeInTheDocument();
    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(1);
  });

  it('usa placeholders para sócio sem nome e pró-labore', () => {
    renderStep(<StepRevisao />, {
      defaultValues: {
        dadosSocios: {
          socios: [{ ...preenchido.dadosSocios.socios[0], nome: '', proLabore: 0 }],
        },
      },
    });

    expect(screen.getByText('Não preenchido')).toBeInTheDocument();
    expect(screen.getByText('Pró-labore: R$ 0.00')).toBeInTheDocument();
  });

  it('marca o aceite dos termos', async () => {
    renderStep(<StepRevisao />, { defaultValues: preenchido });

    await userEvent.click(screen.getByRole('checkbox'));

    expect(lerEstado().documentosAceitos).toBe(true);
  });
});