import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from '@/components/ui/input';

describe('Input', () => {
  it('renderiza um input com o type informado', () => {
    render(<Input type="email" placeholder="E-mail" />);

    const input = screen.getByPlaceholderText('E-mail');
    expect(input).toHaveAttribute('type', 'email');
  });

  it('aceita className adicional', () => {
    render(<Input className="custom-class" data-testid="campo" />);

    expect(screen.getByTestId('campo').className).toContain('custom-class');
  });
});