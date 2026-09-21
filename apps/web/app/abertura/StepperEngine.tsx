'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useForm, FormProvider, useWatch } from 'react-hook-form';
import type { Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { aberturaFormSchema, AberturaFormValues } from '@prolink/shared';

import { socioVazio } from './socioVazio';
import { devSeed } from './devSeed';
import Stepper from '@/components/Stepper';
import StepDadosEmpresa from '@/components/forms/StepDadosEmpresa';
import StepEndereco from '@/components/forms/StepEndereco';
import StepSocios from '@/components/forms/StepSocios';
import StepSociedade from '@/components/forms/StepSociedade';
import StepDocumentos from '@/components/forms/StepDocumentos';
import StepRevisao from '@/components/forms/StepRevisao';

export default function StepperEngine() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [erroRascunho, setErroRascunho] = useState<string | null>(null);

  const methods = useForm<AberturaFormValues>({
    resolver: zodResolver(aberturaFormSchema),
    mode: 'onChange',
    defaultValues: {
      dadosEmpresa: {
        tipoConstituicao: 'ltda',
        nomeEmpresarial1: '',
        nomeEmpresarial2: '',
        nomeEmpresarial3: '',
        nomeFantasia: '',
        atividade: '',
      },
      endereco: {
        cep: '',
        logradouro: '',
        numero: '',
        complemento: '',
        bairro: '',
        municipio: '',
        estado: '',
        iptu: '',
        imovelAlugado: 'nao',
        correspondencia: undefined,
        enderecoCorrespondencia: undefined,
        locadorTipo: undefined,
        tipoFuncionamento: undefined,
      },
      dadosSocios: {
        socios: [socioVazio()],
      },
      sociedade: {
        capitalSocial: undefined,
        quotas: [{ percentual: '' as unknown as number, isAdministrador: false }],
        tipoAdministracao: 'isoladamente',
        banco: '',
      },
      senhaGovBr: '',
      documentosAceitos: false,
    }
  });

  const tipoConstituicao = useWatch({
    control: methods.control,
    name: 'dadosEmpresa.tipoConstituicao'
  });
  
  const isSlu = tipoConstituicao === 'slu';

  const baseStep = searchParams.get('step');
  const currentStep = baseStep ? parseInt(baseStep, 10) : 1;

  useEffect(() => {
    const totalSteps = isSlu ? 5 : 6;
    if (!baseStep || currentStep < 1 || currentStep > totalSteps || isNaN(currentStep)) {
      router.replace(`?step=1`);
    }
  }, [baseStep, currentStep, isSlu, router]);

  // Restaura rascunho salvo (se existir) assim que a sessão é estabelecida.
  useEffect(() => {
    (async () => {
      try {
        if (process.env.NODE_ENV === 'development') {
          methods.reset({ ...methods.getValues(), ...devSeed });
        }
        await fetch('/api/session', { method: 'POST' });
        const res = await fetch('/api/draft');
        if (!res.ok) return;
        const { payload } = await res.json() as { payload: Partial<AberturaFormValues> | null };
        if (payload && Object.keys(payload).length > 0) {
          methods.reset({ ...methods.getValues(), ...payload });
        }
      } catch (err) {
        console.error('Erro ao restaurar rascunho:', err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveDraft = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(methods.getValues()),
      });
      if (!res.ok) throw new Error('Falha ao salvar rascunho');
      setErroRascunho(null);
      return true;
    } catch (err) {
      console.error('Erro ao salvar rascunho:', err);
      setErroRascunho('Não foi possível salvar seu progresso. Tente novamente.');
      return false;
    }
  };

  const handleNext = async () => {
    const totalSteps = isSlu ? 5 : 6;
    let fieldsToValidate: Path<AberturaFormValues>[] = [];

    switch(currentStep) {
      case 1: fieldsToValidate = ['dadosEmpresa']; break;
      case 2: fieldsToValidate = ['endereco']; break;
      case 3: fieldsToValidate = ['dadosSocios']; break;
      case 4: fieldsToValidate = isSlu ? [] : ['sociedade']; break;
      case 5: fieldsToValidate = isSlu ? ['documentosAceitos'] : []; break;
      case 6: fieldsToValidate = ['documentosAceitos']; break;
      default: fieldsToValidate = []; break;
    }

    // Dispara a validação Zod nos formulários da página atual.
    const isValid = fieldsToValidate.length > 0 ? await methods.trigger(fieldsToValidate, { shouldFocus: true }) : true;

    if (!isValid) return;

    if (currentStep < totalSteps) {
      const salvou = await saveDraft();
      if (!salvou) return;
      router.push(`?step=${currentStep + 1}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(methods.getValues()),
      });

      if (!res.ok) {
        console.error('Erro ao enviar formulário:', await res.json().catch(() => null));
        return;
      }

      const { protocolo } = await res.json() as { protocolo: string };
      router.push(`/abertura/confirmacao?protocolo=${encodeURIComponent(protocolo)}`);
    } catch (err) {
      console.error('Erro ao enviar formulário:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      router.push(`?step=${currentStep - 1}`);
    }
  };

  let CurrentView;
  
  if (isSlu) {
    switch (currentStep) {
      case 1: CurrentView = <StepDadosEmpresa />; break;
      case 2: CurrentView = <StepEndereco />; break;
      case 3: CurrentView = <StepSocios isSlu={isSlu} />; break;
      case 4: CurrentView = <StepDocumentos />; break;
      case 5: CurrentView = <StepRevisao />; break;
      default: CurrentView = <StepDadosEmpresa />;
    }
  } else {
    switch (currentStep) {
      case 1: CurrentView = <StepDadosEmpresa />; break;
      case 2: CurrentView = <StepEndereco />; break;
      case 3: CurrentView = <StepSocios isSlu={isSlu} />; break;
      case 4: CurrentView = <StepSociedade />; break;
      case 5: CurrentView = <StepDocumentos />; break;
      case 6: CurrentView = <StepRevisao />; break;
      default: CurrentView = <StepDadosEmpresa />;
    }
  }

  const isLastStep = isSlu ? currentStep === 5 : currentStep === 6;

  return (
    <FormProvider {...methods}>
      <div className="w-full flex-1 flex flex-col">
        <div className="w-full px-4 border-b border-border bg-white sticky top-14 z-20 hidden sm:block shadow-sm">
          <Stepper currentStep={currentStep} isSlu={isSlu} />
        </div>

        <div className="flex-1 px-4 md:px-12 py-10 md:py-14 bg-surfaceAlt/30 pb-32">
          <div className="max-w-4xl mx-auto">
            {CurrentView}
          </div>
        </div>

        {erroRascunho && (
          <div className="px-4 md:px-12 py-2 bg-error/10 border-t border-error/30">
            <p className="max-w-4xl mx-auto text-sm text-error">{erroRascunho}</p>
          </div>
        )}

        <div className="w-full h-20 bg-white border-t border-border px-4 md:px-12 flex items-center justify-between sticky bottom-0 left-0 z-30">
          <div className="flex max-w-4xl w-full mx-auto justify-between items-center">
            <div>
              {currentStep > 1 && (
                <Button 
                  variant="outline" 
                  onClick={handleBack} 
                  className="gap-2 border-border hover:bg-warm px-6"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar
                </Button>
              )}
            </div>
            
            <Button
              className="gap-2 px-8 bg-brand hover:bg-brand/90"
              onClick={handleNext}
              disabled={isSubmitting}
            >
              {isLastStep ? (isSubmitting ? 'Enviando...' : 'Concluir e Enviar') : 'Avançar'}
              {!isLastStep && <ArrowRight className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </FormProvider>
  );
}
