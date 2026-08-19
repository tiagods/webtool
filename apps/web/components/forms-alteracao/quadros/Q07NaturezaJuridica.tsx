'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { AlteracaoFormValues } from '@prolink/shared';

import { Textarea } from '@/components/ui/textarea';
import { FormField, FormItem, FormControl, FormMessage, FormLabel } from '@/components/ui/form';
import RadioCard from '@/components/RadioCard';

export default function Q07NaturezaJuridica() {
  const { control } = useFormContext<AlteracaoFormValues>();
  const tipoTransformacao = useWatch({ control, name: 'q07.tipoTransformacao' });

  return (
    <div className="bg-white border border-border rounded-xl p-5 md:p-7 flex flex-col gap-6 shadow-sm">
      <h3 className="font-display text-lg font-bold text-brand">Q07 — Transformação da Natureza Jurídica</h3>

      <FormField
        control={control}
        name="q07.tipoTransformacao"
        render={({ field }) => (
          <FormItem className="flex flex-col gap-3">
            <FormLabel className="text-textAlt font-semibold text-[13px]">Tipo de Transformação</FormLabel>
            <div className="grid grid-cols-1 gap-3">
              <FormControl>
                <RadioCard
                  title="Ltda → Simples Limitada"
                  description="De Sociedade Empresária Limitada para Sociedade Simples Limitada (Registro no Cartório)."
                  selected={field.value === 'ltda_para_simples'}
                  onClick={() => field.onChange('ltda_para_simples')}
                />
              </FormControl>
              <FormControl>
                <RadioCard
                  title="Simples Limitada → Ltda"
                  description="De Sociedade Simples Limitada para Sociedade Empresária Limitada (Registro na JUCESP)."
                  selected={field.value === 'simples_para_ltda'}
                  onClick={() => field.onChange('simples_para_ltda')}
                />
              </FormControl>
              <FormControl>
                <RadioCard
                  title="Outras"
                  description="Outra transformação não listada acima."
                  selected={field.value === 'outras'}
                  onClick={() => field.onChange('outras')}
                />
              </FormControl>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      {tipoTransformacao === 'outras' && (
        <FormField
          control={control}
          name="q07.especificar"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2">
              <FormLabel className="text-textAlt font-semibold text-[13px]">Especifique a Transformação</FormLabel>
              <FormControl>
                <Textarea {...field} className="bg-warm resize-none h-[80px]" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
}
