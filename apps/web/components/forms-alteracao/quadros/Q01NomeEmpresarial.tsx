'use client';

import { useFormContext } from 'react-hook-form';
import { AlteracaoFormValues } from '@prolink/shared';

import { Input } from '@/components/ui/input';
import { FormField, FormItem, FormControl, FormMessage, FormLabel } from '@/components/ui/form';

export default function Q01NomeEmpresarial() {
  const { control } = useFormContext<AlteracaoFormValues>();

  return (
    <div className="bg-white border border-border rounded-xl p-5 md:p-7 flex flex-col gap-4 shadow-sm">
      <h3 className="font-display text-lg font-bold text-brand">Q01 — Razão Social</h3>
      <p className="text-xs text-muted -mt-2">Será realizada busca de disponibilidade no órgão de registro competente.</p>

      <FormField
        control={control}
        name="q01.nomeEmpresarial1"
        render={({ field }) => (
          <FormItem className="flex flex-col gap-1.5">
            <FormLabel className="text-text font-semibold text-[12px] uppercase tracking-wide text-accent">1ª Opção</FormLabel>
            <FormControl>
              <Input {...field} className="bg-warm h-12 text-base" placeholder="Ex: João da Silva Serviços Ltda" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="q01.nomeEmpresarial2"
        render={({ field }) => (
          <FormItem className="flex flex-col gap-1.5">
            <FormLabel className="text-text font-semibold text-[12px] uppercase tracking-wide text-textAlt">2ª Opção</FormLabel>
            <FormControl>
              <Input {...field} className="bg-warm h-12 text-base" placeholder="Ex: Silva & Associados Serviços Ltda" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="q01.nomeEmpresarial3"
        render={({ field }) => (
          <FormItem className="flex flex-col gap-1.5">
            <FormLabel className="text-text font-semibold text-[12px] uppercase tracking-wide text-textAlt">3ª Opção</FormLabel>
            <FormControl>
              <Input {...field} className="bg-warm h-12 text-base" placeholder="Ex: JS Consultoria e Serviços Ltda" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
