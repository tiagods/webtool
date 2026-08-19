'use client';

import { useFormContext } from 'react-hook-form';
import { AlteracaoFormValues } from '@prolink/shared';

import { Textarea } from '@/components/ui/textarea';
import { FormField, FormItem, FormControl, FormMessage, FormLabel } from '@/components/ui/form';

export default function Q02ObjetoSocial() {
  const { control } = useFormContext<AlteracaoFormValues>();

  return (
    <div className="bg-white border border-border rounded-xl p-5 md:p-7 flex flex-col gap-4 shadow-sm">
      <h3 className="font-display text-lg font-bold text-brand">Q02 — Objeto Social</h3>
      <p className="text-xs text-muted -mt-2">
        Não pode ser ilícito, impossível ou indeterminado. Deve conter declaração precisa da atividade (gênero e espécie).
      </p>

      <FormField
        control={control}
        name="q02.novoObjetoSocial"
        render={({ field }) => (
          <FormItem className="flex flex-col gap-2">
            <FormLabel className="text-textAlt font-semibold text-[13px]">Descrição do Novo Objeto Social</FormLabel>
            <FormControl>
              <Textarea {...field} className="bg-warm resize-none h-[100px]" placeholder="Descreva a nova atividade com o máximo de detalhes..." />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
