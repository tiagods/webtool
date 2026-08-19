'use client';

import { useEffect } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { IMaskInput } from 'react-imask';
import { AlteracaoFormValues } from '@prolink/shared';

import { Input } from '@/components/ui/input';
import { FormField, FormItem, FormControl, FormMessage, FormLabel } from '@/components/ui/form';
import { CEP_MASK } from '@/lib/masks';
import { useViaCEP } from '@/lib/viacep';

export default function Q03Endereco() {
  const { control, setValue } = useFormContext<AlteracaoFormValues>();
  const cep = useWatch({ control, name: 'q03.cep' });
  const { data, status, error } = useViaCEP(cep ?? '');

  useEffect(() => {
    if (status === 'success' && data) {
      setValue('q03.logradouro', data.logradouro, { shouldValidate: true });
      setValue('q03.bairro', data.bairro, { shouldValidate: true });
      setValue('q03.municipio', data.localidade, { shouldValidate: true });
      setValue('q03.estado', data.uf, { shouldValidate: true });
    }
  }, [data, status, setValue]);

  const autoFilled = status === 'success';

  return (
    <div className="bg-white border border-border rounded-xl p-5 md:p-7 flex flex-col gap-6 shadow-sm">
      <h3 className="font-display text-lg font-bold text-brand">Q03 — Mudança de Endereço da Sede</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <FormField
          control={control}
          name="q03.cep"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-2">
              <FormLabel className="text-textAlt font-semibold text-[13px]">CEP</FormLabel>
              <FormControl>
                <IMaskInput
                  mask={CEP_MASK}
                  value={field.value ?? ''}
                  onAccept={(value) => field.onChange(value)}
                  onBlur={field.onBlur}
                  inputRef={field.ref}
                  className="flex h-10 w-full rounded-md border border-input bg-warm px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="00000-000"
                />
              </FormControl>
              {status === 'loading' && <p className="text-xs text-muted">Buscando endereço...</p>}
              {error && <p className="text-xs text-error">{error}</p>}
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="q03.iptu"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-2 md:col-span-3">
              <FormLabel className="text-textAlt font-semibold text-[13px]">Número do IPTU</FormLabel>
              <FormControl>
                <Input {...field} className="bg-warm" placeholder="Obrigatório" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <FormField
          control={control}
          name="q03.logradouro"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-2 md:col-span-4">
              <FormLabel className="text-textAlt font-semibold text-[13px]">Logradouro</FormLabel>
              <FormControl>
                <Input {...field} className="bg-warm disabled:opacity-70" disabled={autoFilled} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="q03.estado"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-2 md:col-span-2">
              <FormLabel className="text-textAlt font-semibold text-[13px]">UF</FormLabel>
              <FormControl>
                <Input {...field} className="bg-warm disabled:opacity-70" maxLength={2} disabled={autoFilled} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <FormField
          control={control}
          name="q03.bairro"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-2 md:col-span-3">
              <FormLabel className="text-textAlt font-semibold text-[13px]">Bairro</FormLabel>
              <FormControl>
                <Input {...field} className="bg-warm disabled:opacity-70" disabled={autoFilled} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="q03.municipio"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-2 md:col-span-3">
              <FormLabel className="text-textAlt font-semibold text-[13px]">Município</FormLabel>
              <FormControl>
                <Input {...field} className="bg-warm disabled:opacity-70" disabled={autoFilled} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
