import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox } from '@/components/ui/checkbox';

describe('Checkbox', () => {
  it('alterna o estado ao ser clicado', async () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="Aceito" onCheckedChange={onCheckedChange} />);

    const checkbox = screen.getByRole('checkbox', { name: 'Aceito' });
    expect(checkbox).toHaveAttribute('data-state', 'unchecked');

    await userEvent.click(checkbox);

    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(checkbox).toHaveAttribute('data-state', 'checked');
  });

  it('renderiza o indicador quando começa marcado', () => {
    const { container } = render(<Checkbox aria-label="Aceito" checked />);

    expect(container.querySelector('svg.lucide-check')).toBeInTheDocument();
  });
});