'use client';

import { useEffect, useState } from 'react';
import { useFormContext, useFieldArray, useWatch } from 'react-hook-form';
import { IMaskInput } from 'react-imask';
import { AlteracaoFormValues } from '@prolink/shared';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FormField, FormItem, FormControl, FormMessage, FormLabel } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import RadioChip from '@/components/RadioChip';
import { Users, Plus, Trash2 } from 'lucide-react';
import { CEP_MASK, CPF_MASK, PIS_MASK, PHONE_MASK, CNPJ_MASK, CURRENCY_MASK } from '@/lib/masks';
import { useViaCEP } from '@/lib/viacep';
import { UF_OPTIONS } from '@/lib/uf';

function defaultMembro(tipo: 'cedente' | 'cessionario') {
  const base = {
    nomeCompleto: '',
    naturalidade: '',
    estadoNaturalidade: '',
    profissao: '',
    rg: '',
    digitoRg: '',
    orgaoExpedidor: '',
    estadoExpedidor: '',
    cpf: '',
    dataExpedicaoRg: '',
    dataNascimento: '',
    pis: '',
    logradouro: '',
    numero: '',
    bairro: '',
    municipio: '',
    estado: '',
    cep: '',
    telefoneResidencial: '',
    telefoneComercial: '',
    ramal: '',
    celular: '',
    email: '',
    recados: '',
    nomeMae: '',
    nomePai: '',
    participacaoAnterior: 'nao' as const,
    cnpjAnterior: '',
    percentualParticipacao: 0,
    valorParticipacao: 0,
    estadoCivil: 'solteiro' as const,
  };

  if (tipo === 'cessionario') {
    return { ...base, tipo: 'cessionario' as const, socioAdministrador: '', proLabore: 0 };
  }
  return { ...base, tipo: 'cedente' as const };
}

const ESTADO_CIVIL_OPTIONS: { value: string; label: string }[] = [
  { value: 'solteiro', label: 'Solteiro(a)' },
  { value: 'casado_comunhao_parcial', label: 'Casado(a) - C. Parcial' },
  { value: 'casado_comunhao_universal', label: 'Casado(a) - C. Universal' },
  { value: 'casado_separacao_bens', label: 'Casado(a) - Sep. de Bens' },
  { value: 'casado_separacao_obrigatoria', label: 'Casado(a) - Sep. Obrigatória' },
  { value: 'separado_judicialmente', label: 'Separado(a) Judicialmente' },
  { value: 'divorciado', label: 'Divorciado(a)' },
  { value: 'viuvo', label: 'Viúvo(a)' },
];

function UFSelect({ name, label }: { name: `q04.membros.${number}.estado` | `q04.membros.${number}.estadoNaturalidade` | `q04.membros.${number}.estadoExpedidor`; label: string }) {
  const { control } = useFormContext<AlteracaoFormValues>();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex flex-col gap-2">
          <FormLabel className="text-textAlt text-[13px]">{label}</FormLabel>
          <Select value={field.value} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger className="bg-warm h-10">
                <SelectValue placeholder="UF" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {UF_OPTIONS.map((uf) => (
                <SelectItem key={uf.value} value={uf.value}>{uf.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function MembroEndereco({ index }: { index: number }) {
  const { control, setValue } = useFormContext<AlteracaoFormValues>();
  const cep = useWatch({ control, name: `q04.membros.${index}.cep` });
  const { data, status, error } = useViaCEP(cep ?? '');

  useEffect(() => {
    if (status === 'success' && data) {
      setValue(`q04.membros.${index}.logradouro`, data.logradouro, { shouldValidate: true });
      setValue(`q04.membros.${index}.bairro`, data.bairro, { shouldValidate: true });
      setValue(`q04.membros.${index}.municipio`, data.localidade, { shouldValidate: true });
      setValue(`q04.membros.${index}.estado`, data.uf, { shouldValidate: true });
    }
  }, [data, status, setValue, index]);

  const autoFilled = status === 'success';

  return (
    <div className="flex flex-col gap-4">
      <h4 className="font-semibold text-sm text-text">Endereço</h4>
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <FormField
          control={control}
          name={`q04.membros.${index}.cep`}
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
          name={`q04.membros.${index}.logradouro`}
          render={({ field }) => (
            <FormItem className="flex flex-col gap-2 md:col-span-3">
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
          name={`q04.membros.${index}.numero`}
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
      </div>
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <FormField
          control={control}
          name={`q04.membros.${index}.bairro`}
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
          name={`q04.membros.${index}.municipio`}
          render={({ field }) => (
            <FormItem className="flex flex-col gap-2 md:col-span-2">
              <FormLabel className="text-textAlt text-[13px]">Município</FormLabel>
              <FormControl>
                <Input {...field} className="bg-warm disabled:opacity-70" disabled={autoFilled} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <UFSelect name={`q04.membros.${index}.estado`} label="UF" />
      </div>
    </div>
  );
}

export default function Q04QuadroSocietario() {
  const methods = useFormContext<AlteracaoFormValues>();
  const { control, setValue } = methods;
  const [activeTab, setActiveTab] = useState(0);

  const { fields, append, remove } = useFieldArray({ control, name: 'q04.membros' });
  const currentIndex = activeTab < fields.length ? activeTab : 0;

  const tipo = useWatch({ control, name: `q04.membros.${currentIndex}.tipo` });
  const participacaoAnterior = useWatch({ control, name: `q04.membros.${currentIndex}.participacaoAnterior` });

  const handleAddMembro = (novoTipo: 'cedente' | 'cessionario') => {
    append(defaultMembro(novoTipo));
    setActiveTab(fields.length);
  };

  const handleChangeTipo = (novoTipo: 'cedente' | 'cessionario') => {
    if (novoTipo === 'cessionario') {
      setValue(`q04.membros.${currentIndex}.socioAdministrador`, '');
      setValue(`q04.membros.${currentIndex}.proLabore`, 0);
    }
    setValue(`q04.membros.${currentIndex}.tipo`, novoTipo, { shouldValidate: true });
  };

  return (
    <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
      <div className="px-5 md:px-7 pt-5 md:pt-7">
        <h3 className="font-display text-lg font-bold text-brand mb-1">Q04 — Quadro Societário</h3>
        <p className="text-xs text-muted mb-4">Adicione cada sócio que sai (cedente) ou entra (cessionário) na sociedade.</p>
      </div>

      {fields.length > 0 && (
        <div className="h-14 bg-surfaceAlt border-b border-border flex items-center px-2 overflow-x-auto select-none">
          {fields.map((field, index) => {
            const isActive = currentIndex === index;
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
                {isActive && (
                  <div
                    className="ml-2 hover:bg-destructive/10 p-1 rounded-md text-destructive transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(index);
                      setActiveTab(Math.max(0, index - 1));
                    }}
                    title="Remover"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {fields.length > 0 && (
        <div className="p-5 md:p-7 flex flex-col gap-8">
          <FormField
            control={control}
            name={`q04.membros.${currentIndex}.tipo`}
            render={() => (
              <FormItem className="flex flex-col gap-3">
                <FormLabel className="text-textAlt font-semibold text-[13px]">Este sócio está saindo ou entrando?</FormLabel>
                <FormControl>
                  <div className="flex gap-2">
                    <RadioChip label="Cedente (sai)" selected={tipo === 'cedente'} onClick={() => handleChangeTipo('cedente')} />
                    <RadioChip label="Cessionário (entra)" selected={tipo === 'cessionario'} onClick={() => handleChangeTipo('cessionario')} />
                  </div>
                </FormControl>
              </FormItem>
            )}
          />

          <hr className="border-border" />

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={control}
                name={`q04.membros.${currentIndex}.nomeCompleto`}
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
              <FormField
                control={control}
                name={`q04.membros.${currentIndex}.profissao`}
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={control}
                name={`q04.membros.${currentIndex}.naturalidade`}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel className="text-textAlt font-semibold text-[13px]">Naturalidade</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-warm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <UFSelect name={`q04.membros.${currentIndex}.estadoNaturalidade`} label="Estado de Naturalidade" />
              <FormField
                control={control}
                name={`q04.membros.${currentIndex}.dataNascimento`}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel className="text-textAlt font-semibold text-[13px]">Data de Nascimento</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" className="bg-warm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <hr className="border-border" />

          <div className="flex flex-col gap-4">
            <h4 className="font-semibold text-sm text-text">Documentos</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <FormField
                control={control}
                name={`q04.membros.${currentIndex}.rg`}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel className="text-textAlt text-[13px]">RG</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-warm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`q04.membros.${currentIndex}.digitoRg`}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel className="text-textAlt text-[13px]">Dígito</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-warm" maxLength={2} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`q04.membros.${currentIndex}.orgaoExpedidor`}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel className="text-textAlt text-[13px]">Órgão Expedidor</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-warm" placeholder="SSP" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <UFSelect name={`q04.membros.${currentIndex}.estadoExpedidor`} label="Estado Expedidor" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={control}
                name={`q04.membros.${currentIndex}.dataExpedicaoRg`}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel className="text-textAlt text-[13px]">Data de Expedição do RG</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" className="bg-warm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`q04.membros.${currentIndex}.cpf`}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel className="text-textAlt text-[13px]">CPF</FormLabel>
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
                name={`q04.membros.${currentIndex}.pis`}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel className="text-textAlt text-[13px]">PIS</FormLabel>
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
            </div>
          </div>

          <hr className="border-border" />

          <MembroEndereco index={currentIndex} />

          <hr className="border-border" />

          <div className="flex flex-col gap-4">
            <h4 className="font-semibold text-sm text-text">Contato</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={control}
                name={`q04.membros.${currentIndex}.celular`}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel className="text-textAlt text-[13px]">Celular</FormLabel>
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
              <FormField
                control={control}
                name={`q04.membros.${currentIndex}.email`}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel className="text-textAlt text-[13px]">E-mail</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-warm" placeholder="email@exemplo.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={control}
                name={`q04.membros.${currentIndex}.telefoneResidencial`}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel className="text-textAlt text-[13px]">Telefone Residencial (Opcional)</FormLabel>
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
                  name={`q04.membros.${currentIndex}.telefoneComercial`}
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-2">
                      <FormLabel className="text-textAlt text-[13px]">Telefone Comercial (Opcional)</FormLabel>
                      <FormControl>
                        <Input {...field} className="bg-warm" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name={`q04.membros.${currentIndex}.ramal`}
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-2">
                      <FormLabel className="text-textAlt text-[13px]">Ramal (Opcional)</FormLabel>
                      <FormControl>
                        <Input {...field} className="bg-warm" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            <FormField
              control={control}
              name={`q04.membros.${currentIndex}.recados`}
              render={({ field }) => (
                <FormItem className="flex flex-col gap-2">
                  <FormLabel className="text-textAlt text-[13px]">Recados (Opcional)</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-warm" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <hr className="border-border" />

          <div className="flex flex-col gap-5">
            <FormField
              control={control}
              name={`q04.membros.${currentIndex}.estadoCivil`}
              render={({ field }) => (
                <FormItem className="flex flex-col gap-3">
                  <FormLabel className="text-textAlt font-semibold text-[13px]">Estado Civil</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      {ESTADO_CIVIL_OPTIONS.map((opt) => (
                        <RadioChip
                          key={opt.value}
                          label={opt.label}
                          selected={field.value === opt.value}
                          onClick={() => field.onChange(opt.value)}
                        />
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={control}
                name={`q04.membros.${currentIndex}.nomeMae`}
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
                name={`q04.membros.${currentIndex}.nomePai`}
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

          <div className="flex flex-col gap-4 bg-slate-50/50 p-4 rounded-lg border border-border/50">
            <FormField
              control={control}
              name={`q04.membros.${currentIndex}.participacaoAnterior`}
              render={({ field }) => (
                <FormItem className="flex flex-col gap-3">
                  <FormLabel className="text-textAlt text-[13px] font-semibold uppercase tracking-wide">
                    Já teve participação societária em outra empresa?
                  </FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <RadioChip selected={field.value === 'sim'} onClick={() => field.onChange('sim')} label="Sim" />
                      <RadioChip selected={field.value === 'nao'} onClick={() => field.onChange('nao')} label="Não" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {participacaoAnterior === 'sim' && (
              <div className="animate-in fade-in slide-in-from-top-2">
                <FormField
                  control={control}
                  name={`q04.membros.${currentIndex}.cnpjAnterior`}
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

          <hr className="border-border" />

          <div className="flex flex-col gap-4">
            <h4 className="font-semibold text-sm text-text">Participação na Sociedade</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={control}
                name={`q04.membros.${currentIndex}.percentualParticipacao`}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel className="text-textAlt text-[13px]">Percentual de Participação (%)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        className="bg-warm"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`q04.membros.${currentIndex}.valorParticipacao`}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel className="text-textAlt text-[13px]">Valor da Participação (R$)</FormLabel>
                    <FormControl>
                      <IMaskInput
                        {...(CURRENCY_MASK as object)}
                        value={field.value ? String(field.value) : ''}
                        onAccept={(value: string) => {
                          const num = parseFloat(value.replace('R$ ', '').replace(/\./g, '').replace(',', '.')) || 0;
                          field.onChange(num);
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

          {tipo === 'cessionario' && (
            <>
              <hr className="border-border" />
              <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
                <h4 className="font-semibold text-sm text-text">Dados do Cessionário</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={control}
                    name={`q04.membros.${currentIndex}.socioAdministrador`}
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-3">
                        <FormLabel className="text-textAlt text-[13px]">Será sócio administrador?</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <RadioChip selected={field.value === 'sim'} onClick={() => field.onChange('sim')} label="Sim" />
                            <RadioChip selected={field.value === 'nao'} onClick={() => field.onChange('nao')} label="Não" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name={`q04.membros.${currentIndex}.proLabore`}
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-2">
                        <FormLabel className="text-textAlt text-[13px]">Valor do Pró-Labore (R$)</FormLabel>
                        <FormControl>
                          <IMaskInput
                            {...(CURRENCY_MASK as object)}
                            value={field.value ? String(field.value) : ''}
                            onAccept={(value: string) => {
                              const num = parseFloat(value.replace('R$ ', '').replace(/\./g, '').replace(',', '.')) || 0;
                              field.onChange(num);
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
            </>
          )}
        </div>
      )}

      <div className="p-5 md:p-7 pt-0 flex flex-col sm:flex-row gap-3">
        <Button
          variant="outline"
          onClick={() => handleAddMembro('cedente')}
          className="flex-1 flex items-center justify-center gap-2 border-dashed border-2 text-accent hover:text-accent/80 hover:bg-accent/5"
        >
          <Plus className="w-4 h-4" />
          Adicionar cedente (sai)
        </Button>
        <Button
          variant="outline"
          onClick={() => handleAddMembro('cessionario')}
          className="flex-1 flex items-center justify-center gap-2 border-dashed border-2 text-accent hover:text-accent/80 hover:bg-accent/5"
        >
          <Plus className="w-4 h-4" />
          Adicionar cessionário (entra)
        </Button>
      </div>

      {methods?.formState?.errors?.q04?.membros?.root?.message && (
        <div className="px-5 md:px-7 pb-5 text-center text-destructive font-medium text-sm">
          {String(methods.formState.errors.q04.membros.root.message)}
        </div>
      )}
      {!methods?.formState?.errors?.q04?.membros?.root?.message && methods?.formState?.errors?.q04?.membros?.message && (
        <div className="px-5 md:px-7 pb-5 text-center text-destructive font-medium text-sm">
          {String(methods.formState.errors.q04.membros.message)}
        </div>
      )}
    </div>
  );
}
