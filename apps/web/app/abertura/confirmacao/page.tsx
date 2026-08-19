'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

function ConfirmacaoContent() {
  const searchParams = useSearchParams();
  const protocolo = searchParams.get('protocolo');

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-14">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-border p-8 flex flex-col items-center text-center gap-5">
        <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-success" />
        </div>

        <h1 className="font-display text-2xl font-bold text-brand">
          Solicitação enviada!
        </h1>

        <p className="text-sm text-muted leading-relaxed max-w-xs">
          Recebemos sua solicitação de abertura de empresa com sucesso.
          Nossa equipe entrará em contato em breve para dar continuidade ao processo.
        </p>

        {protocolo && (
          <div className="w-full bg-surfaceAlt rounded-xl p-4">
            <p className="text-xs text-muted uppercase tracking-wide mb-1">Protocolo</p>
            <p className="font-display text-lg font-semibold text-text">{protocolo}</p>
          </div>
        )}

        <div className="w-full bg-surfaceAlt rounded-xl p-4 flex flex-col gap-3 text-left">
          {[
            { n: 1, text: 'Validação dos documentos enviados' },
            { n: 2, text: 'Contato da nossa equipe via e-mail' },
            { n: 3, text: 'Assinatura digital via Gov.BR' },
            { n: 4, text: 'Registro na Junta Comercial' },
          ].map(({ n, text }) => (
            <div key={n} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-accent/10 text-accent text-xs font-bold flex items-center justify-center flex-shrink-0">
                {n}
              </span>
              <span className="text-sm text-text">{text}</span>
            </div>
          ))}
        </div>

        <Link href="/" className="w-full">
          <Button className="w-full gap-2 bg-brand hover:bg-brand/90">
            Voltar ao início
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function ConfirmacaoPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted">Carregando...</div>}>
      <ConfirmacaoContent />
    </Suspense>
  );
}
