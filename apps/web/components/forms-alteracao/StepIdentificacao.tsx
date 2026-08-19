'use client';

import { useEffect } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { IMaskInput } from 'react-imask';
import { AlteracaoFormValues } from '@prolink/shared';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormField, FormItem, FormControl, FormMessage, FormLabel } from '@/components/ui/form';
import RadioCard from '@/components/RadioCard';
import RadioChip from '@/components/RadioChip';
import { CEP_MASK, CNPJ_MASK } from '@/lib/masks';
import { useViaCEP } from '@/lib/viacep';

export default function StepIdentificacao() {
  const { control, setValue } = useFormContext<AlteracaoFormValues>();
  const cep = useWatch({ control, name: 'identificacao.enderecoAtual.cep' });
  const { data, status, error } = useViaCEP(cep ?? '');
  const situacao = useWatch({ control, name: 'identificacao.situacao' });

  useEffect(() => {
    if (status === 'success' && data) {
      setValue('identificacao.enderecoAtual.logradouro', data.logradouro, { shouldValidate: true });
      setValue('identificacao.enderecoAtual.bairro', data.bairro, { shouldValidate: true });
      setValue('identificacao.enderecoAtual.municipio', data.localidade, { shouldValidate: true });
      setValue('identificacao.enderecoAtual.estado', data.uf, { shouldValidate: true });
    }
  }, [data, status, setValue]);

  const autoFilled = status === 'success';

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-2">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-brand mb-2">Identificação da Empresa</h2>
        <p className="text-muted text-sm md:text-base max-w-2xl">
          Preencha os dados cadastrais atuais da empresa que passará pela alteração.
        </p>
      </div>

      <div className="bg-white border border-border rounded-xl p-5 md:p-7 flex flex-col gap-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={control}
            name="identificacao.cnpj"
            render={({ field }) => (
              <FormItem className="flex flex-col gap-2">
                <FormLabel className="text-textAlt font-semibold text-[13px]">CNPJ</FormLabel>
                <FormControl>
                  <IMaskInput
                    mask={CNPJ_MASK}
                    value={field.value ?? ''}
                    onAccept={(value) => field.onChange(value)}
                    onBlur={field.onBlur}
                    inputRef={field.ref}
                    className="flex h-10 w-full rounded-md border border-input bg-warm px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder="00.000.000/0000-00"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="identificacao.razaoSocial"
            render={({ field }) => (
              <FormItem className="flex flex-col gap-2">
                <FormLabel className="text-textAlt font-semibold text-[13px]">Razão Social</FormLabel>
                <FormControl>
                  <Input {...field} className="bg-warm" placeholder="Razão social atual" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={control}
          name="identificacao.nomeFantasia"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-2">
              <FormLabel className="text-textAlt font-semibold text-[13px]">Nome Fantasia (Opcional)</FormLabel>
              <FormControl>
                <Input {...field} className="bg-warm" placeholder="Como a empresa é conhecida" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="identificacao.tipoConstituicao"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-3">
              <FormLabel className="text-textAlt font-semibold text-[13px]">Tipo de Constituição Atual</FormLabel>
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

        <div className="flex flex-col gap-4">
          <Label className="text-textAlt font-semibold text-[13px]">Endereço Atual da Sede</Label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={control}
              name="identificacao.enderecoAtual.cep"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-2">
                  <FormLabel className="text-textAlt text-[13px]">CEP</FormLabel>
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <FormField
              control={control}
              name="identificacao.enderecoAtual.logradouro"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-2 md:col-span-4">
                  <FormLabel className="text-textAlt text-[13px]">Logradouro</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-warm disabled:opacity-70" disabled={autoFilled} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="identificacao.enderecoAtual.estado"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-2 md:col-span-2">
                  <FormLabel className="text-textAlt text-[13px]">UF</FormLabel>
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
              name="identificacao.enderecoAtual.bairro"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-2 md:col-span-3">
                  <FormLabel className="text-textAlt text-[13px]">Bairro</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-warm disabled:opacity-70" disabled={autoFilled} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="identificacao.enderecoAtual.municipio"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-2 md:col-span-3">
                  <FormLabel className="text-textAlt text-[13px]">Município</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-warm disabled:opacity-70" disabled={autoFilled} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <hr className="border-border" />

        <FormField
          control={control}
          name="identificacao.situacao"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-3">
              <div>
                <FormLabel className="text-textAlt font-semibold text-[13px]">Situação Cadastral</FormLabel>
                <p className="text-xs text-muted mt-1">
                  Apenas empresas com situação ATIVA podem prosseguir com a alteração contratual.
                </p>
              </div>
              <FormControl>
                <div className="flex flex-wrap gap-2">
                  <RadioChip label="Ativa" selected={field.value === 'ativa'} onClick={() => field.onChange('ativa')} />
                  <RadioChip label="Inapta" selected={field.value === 'inapta'} onClick={() => field.onChange('inapta')} />
                  <RadioChip label="Baixada" selected={field.value === 'baixada'} onClick={() => field.onChange('baixada')} />
                </div>
              </FormControl>
              {situacao && situacao !== 'ativa' && (
                <p className="text-xs text-error">
                  Empresas com situação {situacao.toUpperCase()} não podem prosseguir com a alteração contratual.
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
