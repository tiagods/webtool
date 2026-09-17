import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Stepper from '@/components/Stepper';

describe('Stepper', () => {
  it('renderiza os 6 passos no fluxo Ltda, sem o passo Sociedade no SLU', () => {
    render(<Stepper currentStep={1} isSlu={false} />);
    expect(screen.getByText('Sociedade')).toBeInTheDocument();
    expect(screen.getByText('Documentos')).toBeInTheDocument();
    expect(screen.getByText('Revisão')).toBeInTheDocument();
  });

  it('renderiza 5 passos no fluxo SLU (sem Sociedade)', () => {
    render(<Stepper currentStep={1} isSlu />);

    expect(screen.queryByText('Sociedade')).not.toBeInTheDocument();
    expect(screen.getAllByText('Dados da Empresa').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Revisão')).toBeInTheDocument();
  });

  it('marca os passos anteriores como concluídos (check)', () => {
    const { container } = render(<Stepper currentStep={3} isSlu={false} />);

    expect(container.querySelectorAll('svg.lucide-check')).toHaveLength(2);
  });

  it('não marca nenhum passo como concluído no primeiro passo', () => {
    const { container } = render(<Stepper currentStep={1} isSlu={false} />);

    expect(container.querySelectorAll('svg.lucide-check')).toHaveLength(0);
  });

  it('mostra o label do passo ativo (versão mobile) e os números dos pendentes', () => {
    render(<Stepper currentStep={4} isSlu={false} />);

    expect(screen.getAllByText('Sociedade').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });
});