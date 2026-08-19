import React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { AberturaFormValues } from '@prolink/shared';

import { Label } from '@/components/ui/label';
import { FormField, FormItem, FormControl, FormMessage, FormLabel } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';

export default function StepRevisao() {
  const { control } = useFormContext<AberturaFormValues>();

  const dadosEmpresa = useWatch({ control, name: 'dadosEmpresa' });
  const endereco = useWatch({ control, name: 'endereco' });
  const socios = useWatch({ control, name: 'dadosSocios.socios' }) || [];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-2">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-brand mb-2">Revisão Final</h2>
        <p className="text-muted text-sm md:text-base max-w-2xl">
          Confira atentamente todas as informações antes de confirmar o envio.
        </p>
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
        
        {/* Bloco 1: Empresa */}
        <div className="p-5 md:p-7 border-b border-border">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-brand text-[15px]">Dados da Empresa</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted">Tipo de Constituição</Label>
              <span className="text-sm font-medium text-text uppercase">{dadosEmpresa?.tipoConstituicao}</span>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted">1ª Opção de Nome</Label>
              <span className="text-sm font-medium text-text">{dadosEmpresa?.nomeEmpresarial1 || '-'}</span>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label className="text-xs text-muted">Atividade</Label>
              <span className="text-sm font-medium text-text">{dadosEmpresa?.atividade || '-'}</span>
            </div>
          </div>
        </div>

        {/* Bloco 2: Endereço */}
        <div className="p-5 md:p-7 border-b border-border bg-surfaceAlt/30">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-brand text-[15px]">Endereço-Sede</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label className="text-xs text-muted">Logradouro</Label>
              <span className="text-sm font-medium text-text">
                {endereco?.logradouro ? `${endereco?.logradouro}, ${endereco?.numero} — ${endereco?.bairro}, ${endereco?.municipio}/${endereco?.estado} — CEP: ${endereco?.cep}` : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Bloco 3: Sócios */}
        <div className="p-5 md:p-7 border-b border-border">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-brand text-[15px]">Sócios ({socios.length})</h3>
          </div>
          <div className="flex flex-col gap-4">
            {socios.map((socio, idx) => (
              <div key={idx} className="flex flex-col gap-1 pb-3 border-b border-border/50 last:border-0 last:pb-0">
                 <Label className="text-xs text-muted">Sócio {idx + 1}</Label>
                 <span className="text-sm font-medium text-text">{socio.nome || 'Não preenchido'} — CPF: {socio.cpf || '-'}</span>
                 <span className="text-xs text-muted">Pró-labore: R$ {Number(socio.proLabore || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

         {/* Termo */}
         <div className="p-5 md:p-7 bg-surfaceAlt border-t border-border mt-auto">
            <FormField
               control={control}
               name="documentosAceitos"
               render={({ field }) => (
                 <FormItem className="flex items-start space-x-3">
                   <FormControl>
                     <Checkbox 
                       checked={field.value} 
                       onCheckedChange={field.onChange} 
                       className="mt-1" 
                     />
                   </FormControl>
                   <div className="grid gap-1.5 leading-none">
                     <FormLabel className="text-sm font-medium leading-normal cursor-pointer">
                       Declaro que li e estou de acordo com o Termo de Consentimento e Tratamento de Dados (LGPD).
                     </FormLabel>
                     <p className="text-xs text-muted leading-relaxed">
                       Todos os dados submetidos serão utilizados exclusivamente para o processo de avaliação e abertura da sua empresa, conforme nossas normatizações legais.
                     </p>
                     <FormMessage />
                   </div>
                 </FormItem>
               )}
            />
         </div>
      </div>
    </div>
  );
}
