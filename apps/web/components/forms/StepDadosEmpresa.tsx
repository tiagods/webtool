import React from 'react';
import { useFormContext } from 'react-hook-form';
import { AberturaFormValues } from '@prolink/shared';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormItem, FormControl, FormMessage, FormLabel } from '@/components/ui/form';
import RadioCard from '@/components/RadioCard';

export default function StepDadosEmpresa() {
  const { control } = useFormContext<AberturaFormValues>();

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-2">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-brand mb-2">Dados da Empresa</h2>
        <p className="text-muted text-sm md:text-base max-w-2xl">
          Preencha as informações principais da nova empresa. O tipo de constituição definirá os passos seguintes do formulário.
        </p>
      </div>

      <div className="bg-white border border-border rounded-xl p-5 md:p-7 flex flex-col gap-6 shadow-sm">

        {/* Tipo Constituição */}
        <FormField
          control={control}
          name="dadosEmpresa.tipoConstituicao"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-3">
              <FormLabel className="text-textAlt font-semibold text-[13px]">Tipo de Constituição</FormLabel>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormControl>
                  <RadioCard
                    title="Sociedade Limitada"
                    description="A empresa possui 2 ou mais sócios."
                    selected={field.value === 'ltda'}
                    onClick={() => field.onChange('ltda')}
                  />
                </FormControl>
                <FormControl>
                  <RadioCard
                    title="Sociedade Unipessoal"
                    description="A empresa possui apenas 1 único sócio."
                    selected={field.value === 'slu'}
                    onClick={() => field.onChange('slu')}
                  />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <hr className="border-border" />

        {/* Nomes Empresariais */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-textAlt font-semibold text-[13px]">
              Nomes Empresariais — informe 3 opções por ordem de preferência
            </Label>
            <p className="text-xs text-muted">
              O órgão de registro pode recusar um nome já existente. Por isso pedimos 3 alternativas.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <FormField
              control={control}
              name="dadosEmpresa.nomeEmpresarial1"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-1.5">
                  <FormLabel className="text-text font-semibold text-[12px] uppercase tracking-wide text-accent">1ª Opção</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ex: João da Silva Serviços Ltda" className="bg-warm h-12 text-base" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="dadosEmpresa.nomeEmpresarial2"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-1.5">
                  <FormLabel className="text-text font-semibold text-[12px] uppercase tracking-wide text-textAlt">2ª Opção</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ex: Silva &amp; Associados Serviços Ltda" className="bg-warm h-12 text-base" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="dadosEmpresa.nomeEmpresarial3"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-1.5">
                  <FormLabel className="text-text font-semibold text-[12px] uppercase tracking-wide text-textAlt">3ª Opção</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ex: JS Consultoria e Serviços Ltda" className="bg-warm h-12 text-base" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Nome Fantasia */}
        <div className="grid grid-cols-1 gap-4">
          <FormField
            control={control}
            name="dadosEmpresa.nomeFantasia"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-textAlt font-semibold text-[13px]">Nome Fantasia (Opcional)</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Como a empresa será conhecida pelo público\n Ex: Prestação de serviços de consultoria em gestão empresarial e financeira" className="bg-warm" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Atividade da Empresa */}
        <FormField
          control={control}
          name="dadosEmpresa.atividade"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-2">
              <FormLabel className="text-textAlt font-semibold text-[13px]">Atividade da Empresa (Objeto Social)</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder="Descreva a atividade com o máximo de detalhes..." className="bg-warm resize-none h-[100px]" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
