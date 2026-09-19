import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Label } from '@/components/ui/label';

describe('Label', () => {
  it('renderiza o rótulo associado ao campo', () => {
    render(<Label htmlFor="campo-nome">Nome</Label>);

    expect(screen.getByText('Nome')).toHaveAttribute('for', 'campo-nome');
  });
});