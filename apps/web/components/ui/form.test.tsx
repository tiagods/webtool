import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

const schema = z.object({ nome: z.string().min(1, 'Informe o nome') });

function Formulario({ semItem = false }: { semItem?: boolean }) {
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { nome: '' } });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(vi.fn())} noValidate>
        <FormField
          control={form.control}
          name="nome"
          render={({ field }) =>
            semItem ? (
              <FormLabel>Nome</FormLabel>
            ) : (
              <FormItem>
                <FormLabel>Nome</FormLabel>
                <FormControl>
                  <Input placeholder="Nome completo" {...field} />
                </FormControl>
                <FormDescription>Como consta no RG</FormDescription>
                <FormMessage />
              </FormItem>
            )
          }
        />
        <button type="submit">Enviar</button>
      </form>
    </Form>
  );
}

function CampoForaDoContexto() {
  useFormField();
  return null;
}

function FormSemField() {
  const form = useForm({ defaultValues: { nome: '' } });
  return (
    <Form {...form}>
      <CampoForaDoContexto />
    </Form>
  );
}

function FormNativo({ onSubmit }: { onSubmit: () => void }) {
  const form = useForm({
    resolver: async () => ({ values: {}, errors: { nome: { type: 'required' } } }),
    defaultValues: { nome: '' },
  });
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FormField
          control={form.control}
          name="nome"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input placeholder="Sem mensagem" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <button type="submit">Enviar nativo</button>
      </form>
    </Form>
  );
}

describe('form', () => {
  it('renderiza label, descrição e liga o aria-describedby', () => {
    render(<Formulario />);

    expect(screen.getByText('Nome')).toBeInTheDocument();
    expect(screen.getByText('Como consta no RG')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nome completo')).toHaveAttribute(
      'aria-describedby',
      expect.stringContaining('form-item-description')
    );
  });

  it('mostra o erro de validação e limpa ao preencher', async () => {
    render(<Formulario />);

    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByText('Informe o nome')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nome completo')).toHaveAttribute('aria-invalid', 'true');

    await userEvent.type(screen.getByPlaceholderText('Nome completo'), 'Maria');

    await waitFor(() =>
      expect(screen.queryByText('Informe o nome')).not.toBeInTheDocument()
    );
  });

  it('não renderiza mensagem quando o erro não traz message', async () => {
    const onSubmit = vi.fn();
    render(<FormNativo onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button', { name: 'Enviar nativo' }));

    await waitFor(() =>
      expect(screen.getByPlaceholderText('Sem mensagem')).toHaveAttribute('aria-invalid', 'true')
    );
    expect(document.querySelector('p[id$="form-item-message"]')).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('lança quando useFormField é usado fora de um FormField', () => {
    const erroConsole = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<FormSemField />)).toThrow(
      'useFormField should be used within <FormField>'
    );

    erroConsole.mockRestore();
  });

  it('lança quando useFormField é usado dentro de FormField mas fora de FormItem', () => {
    const erroConsole = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Formulario semItem />)).toThrow(
      'useFormField should be used within <FormItem>'
    );

    erroConsole.mockRestore();
  });
});