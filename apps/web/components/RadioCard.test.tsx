import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RadioCard from '@/components/RadioCard';

describe('RadioCard', () => {
  it('renderiza título e descrição', () => {
    render(
      <RadioCard title="Ltda" description="Sociedade limitada" selected={false} onClick={() => {}} />
    );

    expect(screen.getByText('Ltda')).toBeInTheDocument();
    expect(screen.getByText('Sociedade limitada')).toBeInTheDocument();
  });

  it('omite a descrição quando ela não é informada', () => {
    const { container } = render(
      <RadioCard title="SLU" selected={false} onClick={() => {}} />
    );

    expect(screen.queryByText('Sociedade limitada')).not.toBeInTheDocument();
    expect(container.querySelector('.lucide-check')).toBeNull();
  });

  it('mostra o check quando selecionado', () => {
    const { container } = render(<RadioCard title="Ltda" selected onClick={() => {}} />);

    expect(container.querySelector('svg.lucide-check')).toBeInTheDocument();
  });

  it('chama onClick ao ser clicado', async () => {
    const onClick = vi.fn();
    render(<RadioCard title="Ltda" selected={false} onClick={onClick} />);

    await userEvent.click(screen.getByText('Ltda'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});