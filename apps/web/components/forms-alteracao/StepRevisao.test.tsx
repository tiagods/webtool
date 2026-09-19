import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderAlteracao } from '@/mocks/alteracao-harness';

const nav = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push }),
}));

import StepRevisao from '@/components/forms-alteracao/StepRevisao';

const completo = {
  identificacao: {
    cnpj: '11.222.333/0001-81',
    razaoSocial: 'Alpha Ltda',
    nomeFantasia: '',
    tipoConstituicao: 'ltda' as const,
    enderecoAtual: {
      logradouro: 'Rua A',
      bairro: 'Centro',
      municipio: 'São Paulo',
      estado: 'SP',
      cep: '01000-000',
    },
    situacao: 'ativa' as const,
  },
  quadros: [
    'nome_empresarial',
    'objeto_social',
    'endereco',
    'quadro_societario',
    'capital_social',
    'redistribuicao_capital',
    'natureza_juridica',
    'administracao',
    'outras_alteracoes',
  ] as const,
  q01: { nomeEmpresarial1: 'Alfa', nomeEmpresarial2: 'Beta', nomeEmpresarial3: 'Gama' },
  q02: { novoObjetoSocial: 'Consultoria empresarial' },
  q03: {
    logradouro: 'Rua B',
    bairro: 'Centro',
    municipio: 'Rio',
    estado: 'RJ',
    cep: '20000-000',
    iptu: '1-2-3',
  },
  q04: {
    membros: [
      { tipo: 'cedente', nomeCompleto: 'Ana Souza', cpf: '123.456.789-09', percentualParticipacao: 50 },
      { tipo: 'cessionario', nomeCompleto: 'Bia Lima', cpf: '987.654.321-00', percentualParticipacao: 50 },
    ],
  },
  q05: {
    valorCapitalSocial: 50000,
    tipoAlteracao: 'aumento' as const,
    valorIntegralizacao: 1000,
    especificarIntegralizacao: 'dinheiro',
  },
  q06: { socios: [{ nomeSocio: 'Ana Souza', percentual: 50, valor: 25000 }] },
  q07: { tipoTransformacao: 'outras' as const, especificar: 'Reorganização' },
  q08: { administradores: ['Ana Souza', 'Bia Lima'] },
  q09: { descricao: 'Outras mudanças contratuais' },
};

describe('StepRevisao (alteração)', () => {
  it('resume identificação e todos os quadros', () => {
    renderAlteracao(<StepRevisao />, { defaultValues: completo });

    expect(screen.getByText('11.222.333/0001-81')).toBeInTheDocument();
    expect(screen.getByText('Alpha Ltda')).toBeInTheDocument();
    expect(
      screen.getByText('Rua A — Centro, São Paulo/SP — CEP: 01000-000')
    ).toBeInTheDocument();
    expect(screen.getByText('ativa')).toBeInTheDocument();

    expect(screen.getByText('Quadros Selecionados (9)')).toBeInTheDocument();
    expect(screen.getByText('1ª Opção: Alfa')).toBeInTheDocument();
    expect(screen.getByText('Consultoria empresarial')).toBeInTheDocument();
    expect(screen.getByText(/Rua B, - — Centro, Rio\/RJ/)).toBeInTheDocument();
    expect(screen.getByText(/Sai: Ana Souza/)).toBeInTheDocument();
    expect(screen.getByText(/Entra: Bia Lima/)).toBeInTheDocument();
    expect(screen.getByText('Aumento para R$ 50000.00')).toBeInTheDocument();
    expect(screen.getByText(/Ana Souza — 50% — R\$ 25000.00/)).toBeInTheDocument();
    expect(screen.getByText('Outras: Reorganização')).toBeInTheDocument();
    expect(screen.getByText('Ana Souza, Bia Lima')).toBeInTheDocument();
    expect(screen.getByText('Outras mudanças contratuais')).toBeInTheDocument();
  });

  it('navega pelo botão Editar', async () => {
    renderAlteracao(<StepRevisao />, { defaultValues: completo });
    nav.push.mockClear();

    await userEvent.click(screen.getAllByText('Editar')[0]);

    expect(nav.push).toHaveBeenCalledWith('?step=1');
  });

  it('usa placeholders quando não há identificação nem quadros', () => {
    renderAlteracao(<StepRevisao />, { defaultValues: {} });

    expect(screen.getByText('Nenhum quadro selecionado.')).toBeInTheDocument();
    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(1);
  });

  it('usa placeholders de todos os quadros quando os dados não foram preenchidos', () => {
    renderAlteracao(<StepRevisao />, {
      defaultValues: {
        quadros: [
          'nome_empresarial',
          'objeto_social',
          'endereco',
          'quadro_societario',
          'capital_social',
          'redistribuicao_capital',
          'natureza_juridica',
          'administracao',
          'outras_alteracoes',
        ] as const,
      },
    });

    expect(screen.getByText('1ª Opção: -')).toBeInTheDocument();
    expect(screen.getAllByText('Nenhum sócio adicionado.')).toHaveLength(2);
    expect(screen.getByText('Alteração da Administração')).toBeInTheDocument();
    expect(screen.getByText('Redução para R$ 0.00')).toBeInTheDocument();
  });

  it('usa placeholders em membros e sócios sem dados', () => {
    renderAlteracao(<StepRevisao />, {
      defaultValues: {
        quadros: ['quadro_societario', 'redistribuicao_capital'],
        q04: { membros: [{ tipo: 'cedente' }] },
        q06: { socios: [{}] },
      },
    });

    expect(screen.getByText(/Sai: - — CPF: - — 0%/)).toBeInTheDocument();
    expect(screen.getByText(/- — 0% — R\$ 0\.00/)).toBeInTheDocument();
  });

  it('mostra o especificar vazio em natureza "outras"', () => {
    renderAlteracao(<StepRevisao />, {
      defaultValues: {
        quadros: ['natureza_juridica'],
        q07: { tipoTransformacao: 'outras' },
      },
    });

    expect(screen.getByText('Outras: -')).toBeInTheDocument();
  });

  it('mostra "nenhum sócio" em quadro societário e redistribuição vazios', () => {
    renderAlteracao(<StepRevisao />, {
      defaultValues: {
        quadros: ['quadro_societario', 'redistribuicao_capital'],
        q04: { membros: [] },
        q06: { socios: [] },
      },
    });

    expect(screen.getAllByText('Nenhum sócio adicionado.')).toHaveLength(2);
  });

  it('resume a transformação Ltda → Simples e a redução de capital', () => {
    renderAlteracao(<StepRevisao />, {
      defaultValues: {
        quadros: ['natureza_juridica', 'capital_social'],
        q07: { tipoTransformacao: 'ltda_para_simples' },
        q05: { valorCapitalSocial: 1000, tipoAlteracao: 'reducao' },
      },
    });

    expect(screen.getByText('Ltda → Simples Limitada')).toBeInTheDocument();
    expect(screen.getByText('Redução para R$ 1000.00')).toBeInTheDocument();
  });

  it('resume a transformação Simples → Ltda', () => {
    renderAlteracao(<StepRevisao />, {
      defaultValues: {
        quadros: ['natureza_juridica'],
        q07: { tipoTransformacao: 'simples_para_ltda' },
      },
    });

    expect(screen.getByText('Simples Limitada → Ltda')).toBeInTheDocument();
  });
});