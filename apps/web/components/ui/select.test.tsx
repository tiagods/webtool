import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function renderSelect({
  open = true,
  value,
  position,
}: {
  open?: boolean;
  value?: string;
  position?: 'popper' | 'item-aligned';
} = {}) {
  render(
    <Select open={open} value={value} onOpenChange={vi.fn()} onValueChange={vi.fn()}>
      <SelectTrigger aria-label="UF">
        <SelectValue placeholder="Selecione" />
      </SelectTrigger>
      <SelectContent position={position}>
        <SelectGroup>
          <SelectLabel>Estados</SelectLabel>
          <SelectItem value="SP">São Paulo</SelectItem>
          <SelectItem value="RJ">Rio de Janeiro</SelectItem>
        </SelectGroup>
        <SelectSeparator />
      </SelectContent>
    </Select>
  );
}

describe('Select', () => {
  it('mostra o placeholder no trigger quando não há valor', () => {
    renderSelect({ open: false });

    expect(screen.getByRole('combobox', { name: 'UF' })).toHaveTextContent('Selecione');
    expect(screen.queryByText('São Paulo')).not.toBeInTheDocument();
  });

  it('renderiza conteúdo, grupo, label, itens e separador (position popper)', () => {
    renderSelect({ value: 'SP' });

    expect(screen.getByText('Estados')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'São Paulo' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Rio de Janeiro' })).toBeInTheDocument();
  });

  it('renderiza conteúdo com position item-aligned', () => {
    renderSelect({ value: 'RJ', position: 'item-aligned' });

    expect(screen.getByRole('option', { name: 'Rio de Janeiro' })).toBeInTheDocument();
  });
});