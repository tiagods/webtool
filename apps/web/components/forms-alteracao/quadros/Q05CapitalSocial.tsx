'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { IMaskInput } from 'react-imask';
import { AlteracaoFormValues } from '@prolink/shared';

import { Textarea } from '@/components/ui/textarea';
import { FormField, FormItem, FormControl, FormMessage, FormLabel } from '@/components/ui/form';
import RadioChip from '@/components/RadioChip';
import { CURRENCY_MASK } from '@/lib/masks';

function currencyToNumber(value: string): number {
  return parseFloat(value.replace('R$ ', '').replace(/\./g, '').replace(',', '.')) || 0;
}

export default function Q05CapitalSocial() {
  const { control } = useFormContext<AlteracaoFormValues>();
  const tipoAlteracao = useWatch({ control, name: 'q05.tipoAlteracao' });

  return (
    <div className="bg-white border border-border rounded-xl p-5 md:p-7 flex flex-col gap-6 shadow-sm">
      <h3 className="font-display text-lg font-bold text-brand">Q05 — Alteração do Capital Social</h3>

      <FormField
        control={control}
        name="q05.tipoAlteracao"
        render={({ field }) => (
          <FormItem className="flex flex-col gap-3">
            <FormLabel className="text-textAlt font-semibold text-[13px]">Tipo de Alteração</FormLabel>
            <FormControl>
              <div className="flex flex-wrap gap-2">
                <RadioChip label="Aumento" selected={field.value === 'aumento'} onClick={() => field.onChange('aumento')} />
                <RadioChip label="Redução" selected={field.value === 'reducao'} onClick={() => field.onChange('reducao')} />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="q05.valorCapitalSocial"
        render={({ field }) => (
          <FormItem className="flex flex-col gap-2 max-w-sm">
            <FormLabel className="text-textAlt font-semibold text-[13px]">Novo Valor do Capital Social</FormLabel>
            <FormControl>
              <IMaskInput
                {...(CURRENCY_MASK as object)}
                value={field.value ? String(field.value) : ''}
                onAccept={(value: string) => field.onChange(currencyToNumber(value))}
                onBlur={field.onBlur}
                inputRef={field.ref}
                className="flex h-10 w-full rounded-md border border-input bg-warm px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="R$ 0,00"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {tipoAlteracao === 'aumento' && (
        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
          <FormField
            control={control}
            name="q05.valorIntegralizacao"
            render={({ field }) => (
              <FormItem className="flex flex-col gap-2 max-w-sm">
                <FormLabel className="text-textAlt font-semibold text-[13px]">Valor da Integralização</FormLabel>
                <FormControl>
                  <IMaskInput
                    {...(CURRENCY_MASK as object)}
                    value={field.value ? String(field.value) : ''}
                    onAccept={(value: string) => field.onChange(currencyToNumber(value))}
                    onBlur={field.onBlur}
                    inputRef={field.ref}
                    className="flex h-10 w-full rounded-md border border-input bg-warm px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder="R$ 0,00"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="q05.especificarIntegralizacao"
            render={({ field }) => (
              <FormItem className="flex flex-col gap-2">
                <FormLabel className="text-textAlt font-semibold text-[13px]">Forma da Integralização</FormLabel>
                <FormControl>
                  <Textarea {...field} className="bg-warm resize-none h-[80px]" placeholder="Especifique a forma de integralização..." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </div>
  );
}
