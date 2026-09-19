import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import SelecaoFichaCard from '@/components/SelecaoFichaCard';

const baseProps = {
  icon: <span data-testid="icone" />,
  iconBgClassName: 'bg-accent/10',
  accentClassName: 'text-accent',
  label: 'Abertura',
  title: 'Abrir empresa',
  description: 'Constitua uma nova empresa.',
  footerText: 'Leva ~10 min',
  ctaLabel: 'Começar',
  href: '/abertura',
};

describe('SelecaoFichaCard', () => {
  it('renderiza como link quando habilitado', () => {
    render(<SelecaoFichaCard {...baseProps} />);

    expect(screen.getByText('Abrir empresa')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Começar/ })).toHaveAttribute('href', '/abertura');
  });

  it('mostra o badge quando informado', () => {
    render(<SelecaoFichaCard {...baseProps} badge="Novo" />);

    expect(screen.getByText('Novo')).toBeInTheDocument();
  });

  it('vira elemento desabilitado, sem link, quando disabled', () => {
    render(<SelecaoFichaCard {...baseProps} disabled />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Começar')).toHaveAttribute('aria-disabled', 'true');
  });
});