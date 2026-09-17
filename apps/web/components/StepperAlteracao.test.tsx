import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import StepperAlteracao from '@/components/StepperAlteracao';

describe('StepperAlteracao', () => {
  it('renderiza os 4 passos do fluxo de alteração', () => {
    render(<StepperAlteracao currentStep={1} />);

    expect(screen.getAllByText('Identificação').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Tipo de Alteração')).toBeInTheDocument();
    expect(screen.getByText('Novos Dados')).toBeInTheDocument();
    expect(screen.getByText('Revisão e Envio')).toBeInTheDocument();
  });

  it('marca os passos anteriores como concluídos', () => {
    const { container } = render(<StepperAlteracao currentStep={3} />);

    expect(container.querySelectorAll('svg.lucide-check')).toHaveLength(2);
  });

  it('não marca conclusão no primeiro passo', () => {
    const { container } = render(<StepperAlteracao currentStep={1} />);

    expect(container.querySelectorAll('svg.lucide-check')).toHaveLength(0);
  });
});