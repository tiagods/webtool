'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useForm, FormProvider, useWatch } from 'react-hook-form';
import type { Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { alteracaoFormSchema, AlteracaoFormValues } from '@prolink/shared';

import StepperAlteracao from '@/components/StepperAlteracao';
import StepIdentificacao from '@/components/forms-alteracao/StepIdentificacao';
import StepTipoAlteracao from '@/components/forms-alteracao/StepTipoAlteracao';
import StepNovosDados from '@/components/forms-alteracao/StepNovosDados';
import StepRevisao from '@/components/forms-alteracao/StepRevisao';
import { QUADRO_KEY } from '@/components/forms-alteracao/quadros.config';

const TOTAL_STEPS = 4;

export default function StepperEngine() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [erroRascunho, setErroRascunho] = useState<string | null>(null);

  const methods = useForm<AlteracaoFormValues>({
    resolver: zodResolver(alteracaoFormSchema),
    mode: 'onChange',
    defaultValues: {
      identificacao: {
        cnpj: '',
        razaoSocial: '',
        nomeFantasia: '',
        tipoConstituicao: 'ltda',
        enderecoAtual: {
          logradouro: '',
          bairro: '',
          municipio: '',
          estado: '',
          cep: '',
        },
        situacao: 'ativa',
      },
      quadros: [],
      aceite: false,
    },
  });

  const quadros = useWatch({ control: methods.control, name: 'quadros' }) ?? [];

  const baseStep = searchParams.get('step');
  const currentStep = baseStep ? parseInt(baseStep, 10) : 1;

  useEffect(() => {
    if (!baseStep || currentStep < 1 || currentStep > TOTAL_STEPS || isNaN(currentStep)) {
      router.replace(`?step=1`);
    }
  }, [baseStep, currentStep, router]);

  // Restaura rascunho salvo (se existir) assim que a sessão é estabelecida.
  useEffect(() => {
    (async () => {
      try {
        await fetch('/api/alteracao/session', { method: 'POST' });
        const res = await fetch('/api/alteracao/draft');
        if (!res.ok) return;
        const { payload } = (await res.json()) as { payload: Partial<AlteracaoFormValues> | null };
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
      const res = await fetch('/api/alteracao/draft', {
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
    let fieldsToValidate: Path<AlteracaoFormValues>[] = [];

    switch (currentStep) {
      case 1: fieldsToValidate = ['identificacao']; break;
      case 2: fieldsToValidate = ['quadros']; break;
      case 3: fieldsToValidate = quadros.map((codigo) => QUADRO_KEY[codigo]) as Path<AlteracaoFormValues>[]; break;
      case 4: fieldsToValidate = ['aceite']; break;
      default: fieldsToValidate = []; break;
    }

    const isValid = fieldsToValidate.length > 0 ? await methods.trigger(fieldsToValidate, { shouldFocus: true }) : true;

    if (!isValid) return;

    if (currentStep < TOTAL_STEPS) {
      const salvou = await saveDraft();
      if (!salvou) return;
      router.push(`?step=${currentStep + 1}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/alteracao/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(methods.getValues()),
      });

      if (!res.ok) {
        console.error('Erro ao enviar formulário:', await res.json().catch(() => null));
        return;
      }

      const { protocolo } = (await res.json()) as { protocolo: string };
      router.push(`/alteracao/confirmacao?protocolo=${encodeURIComponent(protocolo)}`);
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
  switch (currentStep) {
    case 1: CurrentView = <StepIdentificacao />; break;
    case 2: CurrentView = <StepTipoAlteracao />; break;
    case 3: CurrentView = <StepNovosDados />; break;
    case 4: CurrentView = <StepRevisao />; break;
    default: CurrentView = <StepIdentificacao />;
  }

  const isLastStep = currentStep === TOTAL_STEPS;

  return (
    <FormProvider {...methods}>
      <div className="w-full flex-1 flex flex-col">
        <div className="w-full px-4 border-b border-border bg-white sticky top-14 z-20 hidden sm:block shadow-sm">
          <StepperAlteracao currentStep={currentStep} />
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
