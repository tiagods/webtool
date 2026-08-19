import { Suspense } from 'react';
import StepperEngine from './StepperEngine';

export default function AlteracaoPage() {
  return (
    <div className="w-full flex-1 flex flex-col relative">
      <Suspense fallback={<div className="p-8 text-center text-muted">Carregando formulário...</div>}>
        <StepperEngine />
      </Suspense>
    </div>
  );
}
