'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { AlteracaoFormValues } from '@prolink/shared';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FormField, FormItem, FormControl, FormMessage } from '@/components/ui/form';
import { Plus, Trash2 } from 'lucide-react';

export default function Q08Administracao() {
  const { control, setValue } = useFormContext<AlteracaoFormValues>();
  const administradores = useWatch({ control, name: 'q08.administradores' }) ?? [];

  const addAdministrador = () => {
    setValue('q08.administradores', [...administradores, ''], { shouldValidate: true });
  };

  const removeAdministrador = (index: number) => {
    setValue(
      'q08.administradores',
      administradores.filter((_, i) => i !== index),
      { shouldValidate: true },
    );
  };

  return (
    <div className="bg-white border border-border rounded-xl p-5 md:p-7 flex flex-col gap-4 shadow-sm">
      <h3 className="font-display text-lg font-bold text-brand">Q08 — Alteração da Administração</h3>
      <p className="text-xs text-muted -mt-2">Informe o(s) nome(s) do(s) sócio(s) administrador(es).</p>

      <div className="flex flex-col gap-3">
        {administradores.map((_, index) => (
          <div key={index} className="flex items-center gap-2">
            <FormField
              control={control}
              name={`q08.administradores.${index}`}
              render={({ field }) => (
                <FormItem className="flex-1 flex flex-col gap-1">
                  <FormControl>
                    <Input {...field} className="bg-warm" placeholder={`Administrador ${index + 1}`} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {administradores.length > 1 && (
              <button
                type="button"
                onClick={() => removeAdministrador(index)}
                className="p-2 rounded-md text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                title="Remover"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        onClick={addAdministrador}
        className="w-full sm:w-auto flex items-center justify-center gap-2 border-dashed border-2 text-accent hover:text-accent/80 hover:bg-accent/5"
      >
        <Plus className="w-4 h-4" />
        Adicionar administrador
      </Button>
    </div>
  );
}
