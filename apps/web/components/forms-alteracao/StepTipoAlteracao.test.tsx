import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StepTipoAlteracao from '@/components/forms-alteracao/StepTipoAlteracao';
import { lerEstadoAlteracao, renderAlteracao } from '@/mocks/alteracao-harness';

describe('StepTipoAlteracao', () => {
  it('lista os quadros agrupados', () => {
    renderAlteracao(<StepTipoAlteracao />, { defaultValues: { quadros: [] } });

    expect(screen.getByText('Dados da Empresa')).toBeInTheDocument();
    expect(screen.getByText('Razão Social')).toBeInTheDocument();
    expect(screen.getByText('Endereço')).toBeInTheDocument();
    expect(screen.getAllByText('Quadro Societário').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Outras Alterações')).toBeInTheDocument();
  });

  it('seleciona e desseleciona um quadro, criando e limpando o default', async () => {
    renderAlteracao(<StepTipoAlteracao />, { defaultValues: { quadros: [] } });

    await userEvent.click(screen.getByText('Razão Social'));
    expect(lerEstadoAlteracao().quadros).toEqual(['nome_empresarial']);
    expect(lerEstadoAlteracao().q01).toEqual({
      nomeEmpresarial1: '',
      nomeEmpresarial2: '',
      nomeEmpresarial3: '',
    });

    await userEvent.click(screen.getByText('Razão Social'));
    expect(lerEstadoAlteracao().quadros).toEqual([]);
    expect(lerEstadoAlteracao().q01).toBeUndefined();
  });

  it('não sobrescreve dados já preenchidos do quadro', async () => {
    renderAlteracao(<StepTipoAlteracao />, {
      defaultValues: {
        quadros: [],
        q01: { nomeEmpresarial1: 'Alfa', nomeEmpresarial2: 'Beta', nomeEmpresarial3: 'Gama' },
      },
    });

    await userEvent.click(screen.getByText('Razão Social'));

    expect(lerEstadoAlteracao().q01?.nomeEmpresarial1).toBe('Alfa');
  });

  it('renderiza com quadros ausentes (fallback)', () => {
    renderAlteracao(<StepTipoAlteracao />, { defaultValues: {} });

    expect(screen.getByText('Razão Social')).toBeInTheDocument();
  });
});