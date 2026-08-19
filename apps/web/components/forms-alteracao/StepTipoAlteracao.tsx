'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import type { AlteracaoFormValues, QuadroAlteracao } from '@prolink/shared';

import { Checkbox } from '@/components/ui/checkbox';
import { FormField, FormItem, FormControl, FormMessage } from '@/components/ui/form';
import { QUADRO_GROUPS, QUADRO_LABEL, QUADRO_KEY, getQuadroDefault } from './quadros.config';

export default function StepTipoAlteracao() {
  const { control, setValue, getValues } = useFormContext<AlteracaoFormValues>();
  const quadros = useWatch({ control, name: 'quadros' }) ?? [];

  const toggle = (codigo: QuadroAlteracao) => {
    const key = QUADRO_KEY[codigo];
    const selected = quadros.includes(codigo);

    if (selected) {
      setValue('quadros', quadros.filter((c) => c !== codigo), { shouldValidate: true });
      // Limpa os dados do quadro deselecionado — evita enviar dados "órfãos" que o
      // usuário preencheu e depois desmarcou.
      setValue(key, undefined, { shouldValidate: true });
    } else {
      setValue('quadros', [...quadros, codigo], { shouldValidate: true });
      if (!getValues(key)) {
        setValue(key, getQuadroDefault(codigo), { shouldValidate: false });
      }
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-2">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-brand mb-2">Tipo de Alteração</h2>
        <p className="text-muted text-sm md:text-base max-w-2xl">
          Selecione todos os quadros que deseja alterar. O próximo passo exibirá um formulário para cada um.
        </p>
      </div>

      <FormField
        control={control}
        name="quadros"
        render={() => (
          <FormItem className="flex flex-col gap-6">
            <FormControl>
              <div className="flex flex-col gap-5">
                {QUADRO_GROUPS.map((group) => (
                  <div
                    key={group.title}
                    className="bg-white border border-border rounded-xl p-5 md:p-6 shadow-sm flex flex-col gap-3"
                  >
                    <h3 className="font-semibold text-sm text-brand">{group.title}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {group.quadros.map((codigo) => {
                        const isSelected = quadros.includes(codigo);
                        return (
                          <div
                            key={codigo}
                            onClick={() => toggle(codigo)}
                            className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                              isSelected
                                ? 'border-2 border-accent bg-accent/5'
                                : 'border-border bg-warm hover:border-accent/40'
                            }`}
                          >
                            <Checkbox checked={isSelected} className="pointer-events-none" />
                            <span
                              className={`text-sm ${isSelected ? 'font-semibold text-accent' : 'font-medium text-text'}`}
                            >
                              {QUADRO_LABEL[codigo]}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
