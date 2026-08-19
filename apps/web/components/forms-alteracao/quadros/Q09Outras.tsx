'use client';

import { useFormContext } from 'react-hook-form';
import { AlteracaoFormValues } from '@prolink/shared';

import { Textarea } from '@/components/ui/textarea';
import { FormField, FormItem, FormControl, FormMessage, FormLabel } from '@/components/ui/form';

export default function Q09Outras() {
  const { control } = useFormContext<AlteracaoFormValues>();

  return (
    <div className="bg-white border border-border rounded-xl p-5 md:p-7 flex flex-col gap-4 shadow-sm">
      <h3 className="font-display text-lg font-bold text-brand">Q09 — Outras Alterações</h3>

      <FormField
        control={control}
        name="q09.descricao"
        render={({ field }) => (
          <FormItem className="flex flex-col gap-2">
            <FormLabel className="text-textAlt font-semibold text-[13px]">Descrição da Alteração</FormLabel>
            <FormControl>
              <Textarea {...field} className="bg-warm resize-none h-[100px]" placeholder="Descreva a alteração desejada..." />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
