import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StepDadosEmpresa from '@/components/forms/StepDadosEmpresa';
import { lerEstado, renderStep } from '@/mocks/form-harness';

const defaultValues = {
  dadosEmpresa: {
    tipoConstituicao: 'ltda' as const,
    nomeEmpresarial1: '',
    nomeEmpresarial2: '',
    nomeEmpresarial3: '',
    nomeFantasia: '',
    atividade: '',
  },
};

describe('StepDadosEmpresa', () => {
  it('renderiza os campos de tipo, nomes, fantasia e atividade', () => {
    renderStep(<StepDadosEmpresa />, { defaultValues });

    expect(screen.getByText('Tipo de Constituição')).toBeInTheDocument();
    expect(screen.getByText('Sociedade Limitada')).toBeInTheDocument();
    expect(screen.getByText('Sociedade Unipessoal')).toBeInTheDocument();
    expect(screen.getByText('1ª Opção')).toBeInTheDocument();
    expect(screen.getByText('2ª Opção')).toBeInTheDocument();
    expect(screen.getByText('3ª Opção')).toBeInTheDocument();
    expect(screen.getByText('Nome Fantasia (Opcional)')).toBeInTheDocument();
    expect(screen.getByText('Atividade da Empresa (Objeto Social)')).toBeInTheDocument();
  });

  it('troca o tipo de constituição ao clicar nos cards', async () => {
    renderStep(<StepDadosEmpresa />, { defaultValues });

    await userEvent.click(screen.getByText('Sociedade Unipessoal'));
    expect(lerEstado().dadosEmpresa.tipoConstituicao).toBe('slu');

    await userEvent.click(screen.getByText('Sociedade Limitada'));
    expect(lerEstado().dadosEmpresa.tipoConstituicao).toBe('ltda');
  });

  it('preenche as três opções de nome, o fantasia e a atividade', async () => {
    renderStep(<StepDadosEmpresa />, { defaultValues });

    await userEvent.type(
      screen.getByPlaceholderText('Ex: João da Silva Serviços Ltda'),
      'Alpha Serviços Ltda'
    );
    await userEvent.type(
      screen.getByPlaceholderText('Ex: Silva & Associados Serviços Ltda'),
      'Beta Serviços Ltda'
    );
    await userEvent.type(
      screen.getByPlaceholderText('Ex: JS Consultoria e Serviços Ltda'),
      'Gama Serviços Ltda'
    );
    await userEvent.type(
      screen.getByPlaceholderText('Descreva a atividade com o máximo de detalhes...'),
      'Prestação de serviços de consultoria empresarial'
    );

    const estado = lerEstado();
    expect(estado.dadosEmpresa.nomeEmpresarial1).toBe('Alpha Serviços Ltda');
    expect(estado.dadosEmpresa.nomeEmpresarial2).toBe('Beta Serviços Ltda');
    expect(estado.dadosEmpresa.nomeEmpresarial3).toBe('Gama Serviços Ltda');
    expect(estado.dadosEmpresa.atividade).toBe('Prestação de serviços de consultoria empresarial');
  });
});