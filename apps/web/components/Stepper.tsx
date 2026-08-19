import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StepperProps {
  currentStep: number;
  isSlu: boolean;
}

export default function Stepper({ currentStep, isSlu }: StepperProps) {
  // Define os passos baseados no tipo de constituição
  const stepsLtda = [
    { num: 1, label: 'Dados da Empresa' },
    { num: 2, label: 'Endereço' },
    { num: 3, label: 'Sócios' },
    { num: 4, label: 'Sociedade' },
    { num: 5, label: 'Documentos' },
    { num: 6, label: 'Revisão' },
  ];

  const stepsSlu = [
    { num: 1, label: 'Dados da Empresa' },
    { num: 2, label: 'Endereço' },
    { num: 3, label: 'Sócios' },
    { num: 4, label: 'Documentos' },
    { num: 5, label: 'Revisão' },
  ];

  const steps = isSlu ? stepsSlu : stepsLtda;

  return (
    <div className="w-full flex items-center justify-center md:justify-between px-4 py-8 max-w-4xl mx-auto">
      {steps.map((step, index) => {
        const isCompleted = step.num < currentStep;
        const isActive = step.num === currentStep;
        const isPending = step.num > currentStep;
        
        // Em mobile, só mostramos o passo atual de forma compacta e escondemos as linhas longas
        if (isActive) {
           // ... active mobile view goes in a different way or we render dynamically via css
        }

        return (
          <React.Fragment key={step.num}>
            {/* Step Node */}
            <div className="flex items-center group relative">
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 transition-colors",
                  isCompleted && "bg-success",
                  isActive && "bg-accent",
                  isPending && "bg-border"
                )}
              >
                {isCompleted ? (
                  <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                ) : (
                  <span
                    className={cn(
                      "text-[12px] font-bold",
                      (isCompleted || isActive) ? "text-white" : "text-muted"
                    )}
                  >
                    {step.num}
                  </span>
                )}
              </div>
              
              {/* O rótulo escondido no mobile, mostrado a partir do md */}
              <span
                className={cn(
                  "hidden md:block ml-3 text-sm font-semibold whitespace-nowrap",
                  isCompleted && "text-success",
                  isActive && "text-text",
                  isPending && "text-muted"
                )}
              >
                {step.label}
              </span>

              {/* No mobile, queremos mostrar o texto SO do passo ativo ao lado da bolinha?
                  O design pede: "Stepper — Ocultar labels, mostrar só números + step ativo como texto".
                  Vamos injetar o texto logo abaixo ou do lado só no mobile. */}
              {isActive && (
                <span className="md:hidden ml-3 text-sm font-semibold text-text whitespace-nowrap">
                  {step.label}
                </span>
              )}
            </div>

            {/* Connecting Line (except for the last item) */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1 mx-2 md:mx-4 hidden md:block",  // Linha real no desktop
                  isCompleted ? "bg-success" : "bg-border"
                )}
              />
            )}
            
            {/* Linha compacta do mobile */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "w-4 h-0.5 mx-2 md:hidden", 
                  isCompleted ? "bg-success" : "bg-border"
                )}
              />
            )}

          </React.Fragment>
        );
      })}
    </div>
  );
}
