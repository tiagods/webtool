import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

describe('RadioGroup', () => {
  it('seleciona uma opção e notifica onValueChange', async () => {
    const onValueChange = vi.fn();
    render(
      <RadioGroup defaultValue="a" onValueChange={onValueChange} aria-label="Opção">
        <div>
          <RadioGroupItem value="a" id="a" />
          <Label htmlFor="a">Opção A</Label>
        </div>
        <div>
          <RadioGroupItem value="b" id="b" />
          <Label htmlFor="b">Opção B</Label>
        </div>
      </RadioGroup>
    );

    expect(screen.getByLabelText('Opção A')).toHaveAttribute('data-state', 'checked');

    await userEvent.click(screen.getByLabelText('Opção B'));

    expect(onValueChange).toHaveBeenCalledWith('b');
    expect(screen.getByLabelText('Opção B')).toHaveAttribute('data-state', 'checked');
  });
});