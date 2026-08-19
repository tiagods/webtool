'use client'

import { useEffect, useState } from 'react'
import { useFormContext, useFieldArray, useWatch } from 'react-hook-form'
import { IMaskInput } from 'react-imask'
import { AberturaFormValues } from '@prolink/shared'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { FormField, FormItem, FormControl, FormMessage, FormLabel } from '@/components/ui/form'
import RadioChip from '@/components/RadioChip'
import { Users, Plus, Trash2 } from 'lucide-react'
import { CEP_MASK, CPF_MASK, PIS_MASK, PHONE_MASK, CNPJ_MASK, CURRENCY_MASK } from '@/lib/masks'
import { useViaCEP } from '@/lib/viacep'

function SocioEndereco({ index }: { index: number }) {
  const { control, setValue } = useFormContext<AberturaFormValues>()
  const cepRegistro = useWatch({ control, name: `dadosSocios.socios.${index}.cepRegistro` })
  const { data, status, error } = useViaCEP(cepRegistro ?? '')

  useEffect(() => {
    if (status === 'success' && data) {
      setValue(`dadosSocios.socios.${index}.logradouroRegistro`, data.logradouro, { shouldValidate: true })
      setValue(`dadosSocios.socios.${index}.bairroRegistro`, data.bairro, { shouldValidate: true })
    }
  }, [data, status, setValue, index])

  const autoFilled = status === 'success'

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-semibold text-sm text-text">Endereço Residencial do Sócio</h3>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <FormField
          control={control}
          name={`dadosSocios.socios.${index}.cepRegistro`}
          render={({ field }) => (
            <FormItem className="flex flex-col gap-2 md:col-span-2">
              <FormLabel className="text-textAlt text-[13px]">CEP</FormLabel>
              <FormControl>
                <IMaskInput
                  mask={CEP_MASK}
                  value={field.value ?? ''}
                  onAccept={(value) => field.onChange(value)}
                  onBlur={field.onBlur}
                  inputRef={field.ref}
                  className="flex h-10 w-full rounded-md border border-input bg-warm px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
          name={`dadosSocios.socios.${index}.logradouroRegistro`}
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <FormField
          control={control}
          name={`dadosSocios.socios.${index}.bairroRegistro`}
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
          name={`dadosSocios.socios.${index}.numeroRegistro`}
          render={({ field }) => (
            <FormItem className="flex flex-col gap-2 md:col-span-1">
              <FormLabel className="text-textAlt text-[13px]">Número</FormLabel>
              <FormControl>
                <Input {...field} className="bg-warm" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`dadosSocios.socios.${index}.complementoRegistro`}
          render={({ field }) => (
            <FormItem className="flex flex-col gap-2 md:col-span-1">
              <FormLabel className="text-textAlt text-[13px]">Complemento</FormLabel>
              <FormControl>
                <Input {...field} className="bg-warm" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  )
}

export default function StepSocios({ isSlu }: { isSlu: boolean }) {
  const methods = useFormContext<AberturaFormValues>()
  const { control } = methods
  const [activeTab, setActiveTab] = useState(0)

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'dadosSocios.socios',
  })

  const handleAddSocio = () => {
    append({
      nome: '',
      pis: '',
      cpf: '',
      rg: '',
      nacionalidade: '',
      profissao: '',
      proLabore: 0,
      telefoneCelular: '',
      telefoneFixo: '',
      email: '',
      estadoCivil: 'solteiro',
      nomeMae: '',
      nomePai: '',
      cepRegistro: '',
      logradouroRegistro: '',
      numeroRegistro: '',
      complementoRegistro: '',
      bairroRegistro: '',
      teveParticipacaoSocietaria: false,
      cnpjParticipacao: '',
    })
    setActiveTab(fields.length)
  }

  const currentFieldIndex = activeTab < fields.length ? activeTab : 0

  const currentTeveParticipacao = useWatch({
    control,
    name: `dadosSocios.socios.${currentFieldIndex}.teveParticipacaoSocietaria`,
  })

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-2">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-brand mb-2">Dados dos Sócios</h2>
        <p className="text-muted text-sm md:text-base max-w-2xl">
          Preencha os dados {isSlu ? 'do sócio único' : 'de cada sócio'}.
        </p>
      </div>

      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
        {/* Abas */}
        <div className="h-14 bg-surfaceAlt border-b border-border flex items-center px-2 overflow-x-auto select-none">
          {fields.map((field, index) => {
            const isActive = currentFieldIndex === index
            return (
              <div
                key={field.id}
                onClick={() => setActiveTab(index)}
                className={`h-14 px-4 text-sm flex items-center gap-2 cursor-pointer border-b-2 transition-colors shrink-0
                  ${isActive ? 'font-semibold border-accent text-accent' : 'font-medium border-transparent text-muted hover:text-text'}
                `}
              >
                <Users className={`w-4 h-4 ${isActive ? '' : 'opacity-50'}`} />
                Sócio {index + 1}
                {!isSlu && fields.length > 1 && isActive && (
                  <div
                    className="ml-2 hover:bg-destructive/10 p-1 rounded-md text-destructive transition-colors"
                    onClick={(e) => {
                      e.stopPropagation()
                      remove(index)
                      setActiveTab(Math.max(0, index - 1))
                    }}
                    title="Remover sócio"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="p-5 md:p-7 flex flex-col gap-8">

          {/* Identificação */}
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={control}
                name={`dadosSocios.socios.${currentFieldIndex}.nome`}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel className="text-textAlt font-semibold text-[13px]">Nome Completo</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-warm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={control}
                  name={`dadosSocios.socios.${currentFieldIndex}.cpf`}
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-2">
                      <FormLabel className="text-textAlt font-semibold text-[13px]">CPF</FormLabel>
                      <FormControl>
                        <IMaskInput
                          mask={CPF_MASK}
                          value={field.value ?? ''}
                          onAccept={(value) => field.onChange(value)}
                          onBlur={field.onBlur}
                          inputRef={field.ref}
                          className="flex h-10 w-full rounded-md border border-input bg-warm px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          placeholder="000.000.000-00"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name={`dadosSocios.socios.${currentFieldIndex}.rg`}
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-2">
                      <FormLabel className="text-textAlt font-semibold text-[13px]">RG / Órgão Expedidor</FormLabel>
                      <FormControl>
                        <Input {...field} className="bg-warm" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <FormField
                control={control}
                name={`dadosSocios.socios.${currentFieldIndex}.pis`}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel className="text-textAlt font-semibold text-[13px]">PIS</FormLabel>
                    <FormControl>
                      <IMaskInput
                        mask={PIS_MASK}
                        value={field.value ?? ''}
                        onAccept={(value) => field.onChange(value)}
                        onBlur={field.onBlur}
                        inputRef={field.ref}
                        className="flex h-10 w-full rounded-md border border-input bg-warm px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        placeholder="000.00000.00-0"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`dadosSocios.socios.${currentFieldIndex}.nacionalidade`}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel className="text-textAlt font-semibold text-[13px]">Nacionalidade</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-warm" placeholder="Brasileiro(a)" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`dadosSocios.socios.${currentFieldIndex}.profissao`}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel className="text-textAlt font-semibold text-[13px]">Profissão</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-warm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`dadosSocios.socios.${currentFieldIndex}.telefoneCelular`}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel className="text-textAlt font-semibold text-[13px]">Celular</FormLabel>
                    <FormControl>
                      <IMaskInput
                        mask={PHONE_MASK}
                        value={field.value ?? ''}
                        onAccept={(value) => field.onChange(value)}
                        onBlur={field.onBlur}
                        inputRef={field.ref}
                        className="flex h-10 w-full rounded-md border border-input bg-warm px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        placeholder="(00) 00000-0000"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={control}
                name={`dadosSocios.socios.${currentFieldIndex}.email`}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel className="text-textAlt font-semibold text-[13px]">E-mail</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-warm" placeholder="email@exemplo.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`dadosSocios.socios.${currentFieldIndex}.proLabore`}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel className="text-textAlt font-semibold text-[13px]">Pró-Labore (R$)</FormLabel>
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
                  </FormItem>
                )}
              />
            </div>
          </div>

          <hr className="border-border" />

          {/* Estado Civil e Filiação */}
          <div className="flex flex-col gap-5">
            <FormField
              control={control}
              name={`dadosSocios.socios.${currentFieldIndex}.estadoCivil`}
              render={({ field }) => (
                <FormItem className="flex flex-col gap-3">
                  <FormLabel className="text-textAlt font-semibold text-[13px]">Estado Civil</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      <RadioChip label="Solteiro(a)" selected={field.value === 'solteiro'} onClick={() => field.onChange('solteiro')} />
                      <RadioChip label="Casado(a) - C. Parcial" selected={field.value === 'casado_comunhao_parcial'} onClick={() => field.onChange('casado_comunhao_parcial')} />
                      <RadioChip label="Casado(a) - C. Universal" selected={field.value === 'casado_comunhao_universal'} onClick={() => field.onChange('casado_comunhao_universal')} />
                      <RadioChip label="Divorciado(a)/Separado" selected={field.value === 'separado_judicialmente'} onClick={() => field.onChange('separado_judicialmente')} />
                      <RadioChip label="Viúvo(a)" selected={field.value === 'viuvo'} onClick={() => field.onChange('viuvo')} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={control}
                name={`dadosSocios.socios.${currentFieldIndex}.nomeMae`}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel className="text-textAlt font-semibold text-[13px]">Nome da Mãe</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-warm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`dadosSocios.socios.${currentFieldIndex}.nomePai`}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel className="text-textAlt font-semibold text-[13px]">Nome do Pai (Opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-warm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <hr className="border-border" />

          <SocioEndereco index={currentFieldIndex} />

          <hr className="border-border my-2" />

          <div className="flex flex-col gap-4 bg-slate-50/50 p-4 rounded-lg border border-border/50">
            <FormField
              control={control}
              name={`dadosSocios.socios.${currentFieldIndex}.teveParticipacaoSocietaria`}
              render={({ field }) => (
                <FormItem className="flex flex-col gap-3">
                  <FormLabel className="text-textAlt text-[13px] font-semibold uppercase tracking-wide">
                    Já teve participação societária em outra empresa?
                  </FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <RadioChip selected={field.value === true} onClick={() => field.onChange(true)} label="Sim" />
                      <RadioChip selected={field.value === false} onClick={() => field.onChange(false)} label="Não" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {currentTeveParticipacao && (
              <div className="animate-in fade-in slide-in-from-top-2">
                <FormField
                  control={control}
                  name={`dadosSocios.socios.${currentFieldIndex}.cnpjParticipacao`}
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-2 max-w-sm">
                      <FormLabel className="text-textAlt text-[13px]">
                        Informe o CNPJ da empresa anterior <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <IMaskInput
                          mask={CNPJ_MASK}
                          value={field.value ?? ''}
                          onAccept={(value) => field.onChange(value)}
                          onBlur={field.onBlur}
                          inputRef={field.ref}
                          className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          placeholder="00.000.000/0000-00"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </div>

        </div>
      </div>

      {!isSlu && (
        <div className="text-center">
          {fields.length < 10 && (
            <Button
              variant="outline"
              onClick={handleAddSocio}
              className="w-full sm:w-auto flex items-center justify-center gap-2 border-dashed border-2 py-6 text-accent hover:text-accent/80 hover:bg-accent/5 mx-auto"
            >
              <Plus className="w-4 h-4" />
              Adicionar outro sócio
            </Button>
          )}
          {methods?.formState?.errors?.dadosSocios?.socios?.root?.message && (
            <div className="mt-2 text-center text-destructive font-medium text-sm">
              {String(methods.formState.errors.dadosSocios.socios.root.message)}
            </div>
          )}
          {!methods?.formState?.errors?.dadosSocios?.socios?.root?.message && methods?.formState?.errors?.dadosSocios?.socios?.message && (
            <div className="mt-2 text-center text-destructive font-medium text-sm">
              {String(methods.formState.errors.dadosSocios.socios.message)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
