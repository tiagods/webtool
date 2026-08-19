import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StepperAlteracaoProps {
  currentStep: number;
}

const STEPS = [
  { num: 1, label: 'Identificação' },
  { num: 2, label: 'Tipo de Alteração' },
  { num: 3, label: 'Novos Dados' },
  { num: 4, label: 'Revisão e Envio' },
];

export default function StepperAlteracao({ currentStep }: StepperAlteracaoProps) {
  return (
    <div className="w-full flex items-center justify-center md:justify-between px-4 py-8 max-w-4xl mx-auto">
      {STEPS.map((step, index) => {
        const isCompleted = step.num < currentStep;
        const isActive = step.num === currentStep;
        const isPending = step.num > currentStep;

        return (
          <React.Fragment key={step.num}>
            <div className="flex items-center group relative">
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 transition-colors',
                  isCompleted && 'bg-success',
                  isActive && 'bg-accent',
                  isPending && 'bg-border',
                )}
              >
                {isCompleted ? (
                  <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                ) : (
                  <span
                    className={cn(
                      'text-[12px] font-bold',
                      (isCompleted || isActive) ? 'text-white' : 'text-muted',
                    )}
                  >
                    {step.num}
                  </span>
                )}
              </div>

              <span
                className={cn(
                  'hidden md:block ml-3 text-sm font-semibold whitespace-nowrap',
                  isCompleted && 'text-success',
                  isActive && 'text-text',
                  isPending && 'text-muted',
                )}
              >
                {step.label}
              </span>

              {isActive && (
                <span className="md:hidden ml-3 text-sm font-semibold text-text whitespace-nowrap">
                  {step.label}
                </span>
              )}
            </div>

            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  'h-0.5 flex-1 mx-2 md:mx-4 hidden md:block',
                  isCompleted ? 'bg-success' : 'bg-border',
                )}
              />
            )}

            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  'w-4 h-0.5 mx-2 md:hidden',
                  isCompleted ? 'bg-success' : 'bg-border',
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
