import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('renderiza um botão com o conteúdo', () => {
    render(<Button>Salvar</Button>);

    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
  });

  it('aplica as classes da variante e do tamanho', () => {
    render(
      <Button variant="outline" size="lg">
        Cancelar
      </Button>
    );

    const botao = screen.getByRole('button', { name: 'Cancelar' });
    expect(botao.className).toContain('border');
    expect(botao.className).toContain('h-10');
  });

  it('usa Slot e repassa o asChild para um link', () => {
    render(
      <Button asChild>
        <a href="/abertura">Abrir</a>
      </Button>
    );

    expect(screen.getByRole('link', { name: 'Abrir' })).toHaveAttribute('href', '/abertura');
  });
});