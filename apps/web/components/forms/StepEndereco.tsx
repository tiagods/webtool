'use client'

import { useEffect } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { IMaskInput } from 'react-imask'
import { AberturaFormValues } from '@prolink/shared'

import { Input } from '@/components/ui/input'
import { FormField, FormItem, FormControl, FormMessage, FormLabel } from '@/components/ui/form'
import RadioChip from '@/components/RadioChip'
import { CEP_MASK } from '@/lib/masks'
import { useViaCEP } from '@/lib/viacep'

export default function StepEndereco() {
  const { control, setValue } = useFormContext<AberturaFormValues>()
  const cep = useWatch({ control, name: 'endereco.cep' })
  const imovelAlugado = useWatch({ control, name: 'endereco.imovelAlugado' })
  const correspondencia = useWatch({ control, name: 'endereco.correspondencia' })
  const { data, status, error } = useViaCEP(cep ?? '')

  useEffect(() => {
    if (status === 'success' && data) {
      setValue('endereco.logradouro', data.logradouro, { shouldValidate: true })
      setValue('endereco.bairro', data.bairro, { shouldValidate: true })
      setValue('endereco.municipio', data.localidade, { shouldValidate: true })
      setValue('endereco.estado', data.uf, { shouldValidate: true })
    }
  }, [data, status, setValue])

  const autoFilled = status === 'success'
  const loadingCep = status === 'loading'

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-2">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-brand mb-2">Endereço da Sede</h2>
        <p className="text-muted text-sm md:text-base max-w-2xl">
          Preencha o CEP para preenchimento automático.
        </p>
      </div>

      <div className="bg-white border border-border rounded-xl p-5 md:p-7 flex flex-col gap-6 shadow-sm">

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <FormField
            control={control}
            name="endereco.cep"
            render={({ field }) => (
              <FormItem className="flex flex-col gap-2">
                <FormLabel className="text-textAlt font-semibold text-[13px]">CEP</FormLabel>
                <div className="flex bg-warm rounded-md w-full max-w-[200px]">
                  <FormControl>
                    <IMaskInput
                      mask={CEP_MASK}
                      value={field.value ?? ''}
                      onAccept={(value) => field.onChange(value)}
                      onBlur={field.onBlur}
                      inputRef={field.ref}
                      className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 border-0 focus-visible:ring-0"
                      placeholder="00000-000"
                    />
                  </FormControl>
                </div>
                {loadingCep && <p className="text-xs text-muted">Buscando endereço...</p>}
                {error && <p className="text-xs text-error">{error}</p>}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="endereco.iptu"
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
            name="endereco.logradouro"
            render={({ field }) => (
              <FormItem className="flex flex-col gap-2 md:col-span-4">
                <FormLabel className="text-textAlt font-semibold text-[13px]">Logradouro</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className="bg-warm disabled:opacity-70"
                    placeholder="Ex: Rua Direita"
                    disabled={autoFilled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="endereco.numero"
            render={({ field }) => (
              <FormItem className="flex flex-col gap-2 md:col-span-2">
                <FormLabel className="text-textAlt font-semibold text-[13px]">Número</FormLabel>
                <FormControl>
                  <Input {...field} className="bg-warm" placeholder="S/N" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <FormField
            control={control}
            name="endereco.bairro"
            render={({ field }) => (
              <FormItem className="flex flex-col gap-2 md:col-span-3">
                <FormLabel className="text-textAlt font-semibold text-[13px]">Bairro</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className="bg-warm disabled:opacity-70"
                    placeholder="Bairro"
                    disabled={autoFilled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="endereco.complemento"
            render={({ field }) => (
              <FormItem className="flex flex-col gap-2 md:col-span-3">
                <FormLabel className="text-textAlt font-semibold text-[13px]">Complemento (Opcional)</FormLabel>
                <FormControl>
                  <Input {...field} className="bg-warm" placeholder="Ex: Sala 1, Andar 2" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <FormField
            control={control}
            name="endereco.municipio"
            render={({ field }) => (
              <FormItem className="flex flex-col gap-2 md:col-span-3">
                <FormLabel className="text-textAlt font-semibold text-[13px]">Cidade</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className="bg-warm disabled:opacity-70"
                    placeholder="Cidade"
                    disabled={autoFilled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="endereco.estado"
            render={({ field }) => (
              <FormItem className="flex flex-col gap-2 md:col-span-1">
                <FormLabel className="text-textAlt font-semibold text-[13px]">UF</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className="bg-warm disabled:opacity-70"
                    placeholder="SP"
                    maxLength={2}
                    disabled={autoFilled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <hr className="border-border" />

        <FormField
          control={control}
          name="endereco.imovelAlugado"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-3">
              <div>
                <FormLabel className="text-textAlt font-semibold text-[13px]">O imóvel da sede é alugado?</FormLabel>
                <p className="text-xs text-muted mt-1">
                  Se alugado, será necessário enviar o Contrato de Locação na etapa de documentos.
                </p>
              </div>
              <FormControl>
                <div className="flex flex-wrap gap-2">
                  <RadioChip
                    label="Não — Próprio / Cedido"
                    selected={field.value === 'nao'}
                    onClick={() => field.onChange('nao')}
                  />
                  <RadioChip
                    label="Sim — Alugado"
                    selected={field.value === 'sim'}
                    onClick={() => field.onChange('sim')}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

{/* LocadorTipo — condicional */}
        {imovelAlugado === 'sim' && (
          <FormField
            control={control}
            name="endereco.locadorTipo"
            render={({ field }) => (
              <FormItem className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <FormLabel className="text-textAlt font-semibold text-[13px]">Tipo do Locador</FormLabel>
                <FormControl>
                  <div className="flex flex-wrap gap-2">
                    <RadioChip label="Pessoa Física (PF)" selected={field.value === 'pf'} onClick={() => field.onChange('pf')} />
                    <RadioChip label="Pessoa Jurídica (PJ)" selected={field.value === 'pj'} onClick={() => field.onChange('pj')} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <hr className="border-border" />
<FormField
          control={control}
          name="endereco.correspondencia"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-3">
              <FormLabel className="text-textAlt font-semibold text-[13px]">
                O endereço de correspondência é o mesmo da sede?
              </FormLabel>
              <FormControl>
                <div className="flex flex-wrap gap-2">
                  <RadioChip label="Sim" selected={field.value === 'sim'} onClick={() => field.onChange('sim')} />
                  <RadioChip label="Não — informar outro endereço" selected={field.value === 'nao'} onClick={() => field.onChange('nao')} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Endereço de Correspondência */}
        {correspondencia === 'nao' && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <h3 className="font-semibold text-sm text-text">Endereço de Correspondência</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <FormField control={control} name="endereco.enderecoCorrespondencia.cep" render={({ field }) => (
                <FormItem className="flex flex-col gap-2">
                  <FormLabel className="text-textAlt font-semibold text-[13px]">CEP</FormLabel>
                  <FormControl>
                    <IMaskInput mask={CEP_MASK} value={field.value ?? ''} onAccept={(v) => field.onChange(v)} onBlur={field.onBlur} inputRef={field.ref}
                      className="flex h-10 w-full rounded-md border border-input bg-warm px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      placeholder="00000-000" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={control} name="endereco.enderecoCorrespondencia.logradouro" render={({ field }) => (
                <FormItem className="flex flex-col gap-2 md:col-span-3">
                  <FormLabel className="text-textAlt font-semibold text-[13px]">Logradouro</FormLabel>
                  <FormControl><Input {...field} className="bg-warm" placeholder="Rua, Avenida..." /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <FormField control={control} name="endereco.enderecoCorrespondencia.numero" render={({ field }) => (
                <FormItem className="flex flex-col gap-2">
                  <FormLabel className="text-textAlt font-semibold text-[13px]">Número</FormLabel>
                  <FormControl><Input {...field} className="bg-warm" placeholder="Nº" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={control} name="endereco.enderecoCorrespondencia.complemento" render={({ field }) => (
                <FormItem className="flex flex-col gap-2 md:col-span-2">
                  <FormLabel className="text-textAlt font-semibold text-[13px]">Complemento (Opcional)</FormLabel>
                  <FormControl><Input {...field} className="bg-warm" placeholder="Ex: Sala 1" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={control} name="endereco.enderecoCorrespondencia.bairro" render={({ field }) => (
                <FormItem className="flex flex-col gap-2">
                  <FormLabel className="text-textAlt font-semibold text-[13px]">Bairro</FormLabel>
                  <FormControl><Input {...field} className="bg-warm" placeholder="Bairro" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <FormField control={control} name="endereco.enderecoCorrespondencia.municipio" render={({ field }) => (
                <FormItem className="flex flex-col gap-2 md:col-span-3">
                  <FormLabel className="text-textAlt font-semibold text-[13px]">Cidade</FormLabel>
                  <FormControl><Input {...field} className="bg-warm" placeholder="Cidade" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={control} name="endereco.enderecoCorrespondencia.estado" render={({ field }) => (
                <FormItem className="flex flex-col gap-2 md:col-span-1">
                  <FormLabel className="text-textAlt font-semibold text-[13px]">UF</FormLabel>
                  <FormControl><Input {...field} className="bg-warm" placeholder="SP" maxLength={2} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </div>
        )}

        <hr className="border-border" />
<FormField
          control={control}
          name="endereco.tipoFuncionamento"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-3">
              <FormLabel className="text-textAlt font-semibold text-[13px]">Tipo de Funcionamento (Opcional)</FormLabel>
              <FormControl>
                <div className="flex flex-wrap gap-2">
                  <RadioChip label="Comercial" selected={field.value === 'comercial'} onClick={() => field.onChange('comercial')} />
                  <RadioChip label="Industrial" selected={field.value === 'industrial'} onClick={() => field.onChange('industrial')} />
                  <RadioChip label="Serviços" selected={field.value === 'servicos'} onClick={() => field.onChange('servicos')} />
                  <RadioChip label="Outros" selected={field.value === 'outros'} onClick={() => field.onChange('outros')} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

      </div>
    </div>
  )
}
