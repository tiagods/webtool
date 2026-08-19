'use client'

import { useEffect, useMemo } from 'react'
import { useFormContext, useFieldArray, useWatch } from 'react-hook-form'
import { IMaskInput } from 'react-imask'
import { AberturaFormValues } from '@prolink/shared'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { FormField, FormItem, FormControl, FormMessage, FormLabel } from '@/components/ui/form'
import RadioChip from '@/components/RadioChip'
import { CURRENCY_MASK } from '@/lib/masks'

export default function StepSociedade() {
  const { control, setValue } = useFormContext<AberturaFormValues>();

  const sociosRaw = useWatch({ control, name: 'dadosSocios.socios' })
  const socios = useMemo(() => sociosRaw ?? [], [sociosRaw])
  
  const { fields } = useFieldArray({
    control,
    name: 'sociedade.quotas'
  });

  const quotasWatch = useWatch({ control, name: 'sociedade.quotas' }) || [];

  // Sincronizar estado inicial das quotas baseado nos sócios caso esteja vazio
  useEffect(() => {
    if (fields.length !== socios.length) {
      const defaultValue = Number((100 / (socios.length || 1)).toFixed(2));
      const initQuotas = socios.map((_, i) => ({
        percentual: defaultValue,
        isAdministrador: i === 0
      }));
      setValue('sociedade.quotas', initQuotas);
    }
  }, [socios, fields.length, setValue]);

  // Math view
  const totalPercent = quotasWatch.reduce((acc, q) => acc + (Number(q.percentual) || 0), 0);
  const isValidTotal = Math.abs(totalPercent - 100) < 0.02;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-2">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-brand mb-2">Dados da Sociedade</h2>
        <p className="text-muted text-sm md:text-base max-w-2xl">
          Preencha as informações societárias da empresa. Estes campos são exclusivos para Sociedade Limitada.
        </p>
      </div>

      <div className="bg-white border border-border rounded-xl p-5 md:p-7 flex flex-col gap-8 shadow-sm">

        {/* Capital Social */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 bg-accent rounded-sm mb-1" />
            <Label className="text-text font-bold text-[14px]">Capital Social da Empresa</Label>
          </div>
          
          <FormField
            control={control}
            name="sociedade.capitalSocial"
            render={({ field }) => (
              <FormItem className="flex flex-col mt-2 max-w-sm gap-2">
                <FormLabel className="text-textAlt text-[13px]">Valor do Capital Social</FormLabel>
                <FormControl>
                  <IMaskInput
                    {...(CURRENCY_MASK as object)}
                    value={field.value ? String(field.value) : ''}
                    onAccept={(value: string) => {
                      const num = parseFloat(value.replace('R$ ', '').replace(/\./g, '').replace(',', '.')) || 0
                      field.onChange(num)
                    }}
                    onBlur={field.onBlur}
                    inputRef={field.ref}
                    className="flex h-10 w-full rounded-md border border-input bg-warm px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder="R$ 0,00"
                  />
                </FormControl>
                <FormMessage />
                <span className="text-[11px] text-muted -mt-1">Valor que será registrado no contrato social</span>
              </FormItem>
            )}
          />
        </div>

        <hr className="border-border" />

        {/* Divisão de Quotas */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 bg-accent rounded-sm" />
            <Label className="text-text font-bold text-[14px]">Divisão de Quotas do Capital Social (%)</Label>
            <div className={`text-[11px] font-medium rounded px-2 py-0.5 ml-2 ${isValidTotal ? 'text-success bg-success/10' : 'text-destructive bg-destructive/10'}`}>
              Soma: {totalPercent.toFixed(2)}%
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            {fields.map((fieldItem, index) => {
              const socioNome = socios[index]?.nome || `Sócio ${index + 1}`;
              return (
                <FormField
                  key={fieldItem.id}
                  control={control}
                  name={`sociedade.quotas.${index}.percentual`}
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-2">
                      <FormLabel className="text-textAlt text-[13px]">{socioNome}</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            step="0.01"
                            onChange={e => field.onChange(parseFloat(e.target.value))}
                            className="bg-warm pr-8" 
                            placeholder="50" 
                           />
                        </FormControl>
                        <span className="absolute right-3 top-2.5 text-muted text-sm">%</span>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )
            })}
          </div>
        </div>

        <hr className="border-border" />

        {/* Administradores */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 bg-accent rounded-sm" />
            <Label className="text-text font-bold text-[14px]">Sócios Administradores</Label>
          </div>
          <p className="text-muted text-[13px]">Selecione quais sócios serão administradores da empresa. Pelo menos um sócio deve ser administrador.</p>

          <div className="flex flex-col gap-3 mt-2">
            {fields.map((fieldItem, index) => {
              const isAdmin = quotasWatch[index]?.isAdministrador;
              const socioNome = socios[index]?.nome || `Sócio ${index + 1}`;
              return (
                <FormField
                  key={`admin-${fieldItem.id}`}
                  control={control}
                  name={`sociedade.quotas.${index}.isAdministrador`}
                  render={({ field }) => (
                    <FormItem className={`flex items-center space-x-3 rounded-lg p-3 border ${isAdmin ? 'border-accent bg-accent/5' : 'border-border bg-white cursor-pointer'}`}>
                      <FormControl>
                         <Checkbox 
                           checked={field.value} 
                           onCheckedChange={field.onChange} 
                         />
                      </FormControl>
                      <FormLabel className={`text-sm font-medium leading-none cursor-pointer mt-0 ${isAdmin ? '' : 'text-muted'}`}>
                        {socioNome}
                      </FormLabel>
                    </FormItem>
                  )}
                />
              )
            })}
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <FormField
              control={control}
              name="sociedade.tipoAdministracao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-text font-bold text-[13px] block mb-3">Tipo de Administração</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                       <RadioChip label="Isoladamente" selected={field.value === 'isoladamente'} onClick={() => field.onChange('isoladamente')} />
                       <RadioChip label="Conjunta" selected={field.value === 'conjunta'} onClick={() => field.onChange('conjunta')} />
                       <RadioChip label="Outras" selected={field.value === 'outras'} onClick={() => field.onChange('outras')} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <hr className="border-border" />

        {/* Banco */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 bg-accent rounded-sm mb-1" />
            <Label className="text-text font-bold text-[14px]">Conta Bancária da Empresa</Label>
          </div>
          
          <FormField
            control={control}
            name="sociedade.banco"
            render={({ field }) => (
              <FormItem className="flex flex-col mt-2 max-w-sm gap-2">
                <FormLabel className="text-textAlt text-[13px]">Em qual banco será aberta a conta bancária?</FormLabel>
                <FormControl>
                  <Input {...field} className="bg-warm" placeholder="Ex: Itaú, Banco do Brasil..." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

      </div>
    </div>
  );
}
