import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RadioChip from '@/components/RadioChip';

describe('RadioChip', () => {
  it('renderiza o label', () => {
    render(<RadioChip label="Alugado" selected={false} onClick={() => {}} />);

    expect(screen.getByText('Alugado')).toBeInTheDocument();
  });

  it('chama onClick ao ser clicado', async () => {
    const onClick = vi.fn();
    render(<RadioChip label="Próprio" selected={false} onClick={onClick} />);

    await userEvent.click(screen.getByText('Próprio'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('aplica o estilo de selecionado quando selected', () => {
    render(<RadioChip label="Alugado" selected onClick={() => {}} />);

    expect(screen.getByText('Alugado').className).toContain('border-accent');
  });
});