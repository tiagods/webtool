import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Textarea } from '@/components/ui/textarea';

describe('Textarea', () => {
  it('renderiza uma textarea com placeholder', () => {
    render(<Textarea placeholder="Descreva" />);

    expect(screen.getByPlaceholderText('Descreva')).toBeInTheDocument();
  });

  it('aceita className adicional', () => {
    render(<Textarea className="custom-class" data-testid="area" />);

    expect(screen.getByTestId('area').className).toContain('custom-class');
  });
});