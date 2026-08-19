'use client';

import { useFormContext, useFieldArray } from 'react-hook-form';
import { AlteracaoFormValues } from '@prolink/shared';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FormField, FormItem, FormControl, FormMessage, FormLabel } from '@/components/ui/form';
import { Plus, Trash2 } from 'lucide-react';

export default function Q06Redistribuicao() {
  const { control } = useFormContext<AlteracaoFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'q06.socios' });

  return (
    <div className="bg-white border border-border rounded-xl p-5 md:p-7 flex flex-col gap-4 shadow-sm">
      <h3 className="font-display text-lg font-bold text-brand">Q06 — Redistribuição do Capital Social entre os Sócios</h3>

      <div className="flex flex-col gap-4">
        {fields.map((fieldItem, index) => (
          <div
            key={fieldItem.id}
            className="grid grid-cols-1 md:grid-cols-[1fr_140px_160px_auto] gap-3 items-end border-b border-border/50 pb-4 last:border-0 last:pb-0"
          >
            <FormField
              control={control}
              name={`q06.socios.${index}.nomeSocio`}
              render={({ field }) => (
                <FormItem className="flex flex-col gap-1.5">
                  <FormLabel className="text-textAlt text-[13px]">Nome do Sócio</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-warm" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`q06.socios.${index}.percentual`}
              render={({ field }) => (
                <FormItem className="flex flex-col gap-1.5">
                  <FormLabel className="text-textAlt text-[13px]">Percentual (%)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      step="0.01"
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      className="bg-warm"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`q06.socios.${index}.valor`}
              render={({ field }) => (
                <FormItem className="flex flex-col gap-1.5">
                  <FormLabel className="text-textAlt text-[13px]">Valor (R$)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      step="0.01"
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      className="bg-warm"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <button
              type="button"
              onClick={() => remove(index)}
              className="p-2 rounded-md text-destructive hover:bg-destructive/10 transition-colors shrink-0 mb-1"
              title="Remover"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        onClick={() => append({ nomeSocio: '', percentual: 0, valor: 0 })}
        className="w-full sm:w-auto flex items-center justify-center gap-2 border-dashed border-2 text-accent hover:text-accent/80 hover:bg-accent/5"
      >
        <Plus className="w-4 h-4" />
        Adicionar sócio
      </Button>
    </div>
  );
}
