'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { ShieldCheck, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  TERMO_TITULO,
  TERMO_INTRODUCAO,
  TERMO_ITENS,
  TERMO_FINALIDADE,
  TERMO_RETENCAO,
  TERMO_BASE_LEGAL,
  TERMO_CHECKBOX_LABEL,
  TERMO_RECUSA_MENSAGEM,
  TERMO_CONTATO_EMAIL,
} from '@/lib/termo';
import { TERMO_VERSAO_ATUAL } from '@prolink/shared';

const DELAY_HABILITAR_CHECKBOX_MS = 3000;

type Tela = 'termo' | 'recusa';

export default function TermoCienciaModal() {
  const router = useRouter();
  const [tela, setTela] = useState<Tela>('termo');
  const [checkboxHabilitado, setCheckboxHabilitado] = useState(false);
  const [aceito, setAceito] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setCheckboxHabilitado(true), DELAY_HABILITAR_CHECKBOX_MS);
    return () => clearTimeout(timer);
  }, []);

  async function handleAceitar() {
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch('/api/aceite-termo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versaoTermo: TERMO_VERSAO_ATUAL }),
      });
      if (!res.ok) throw new Error('Falha ao registrar aceite');
      router.refresh();
    } catch {
      setErro('Não foi possível registrar seu aceite. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog.Root open>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            'w-[calc(100%-2rem)] max-w-lg',
            'bg-white rounded-2xl shadow-2xl border border-border',
            'p-8 flex flex-col gap-5',
          )}
        >
          {tela === 'termo' ? (
            <>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-5 h-5 text-accent" />
                </div>
                <Dialog.Title className="font-display text-lg font-bold text-brand">
                  {TERMO_TITULO}
                </Dialog.Title>
              </div>

              <Dialog.Description asChild>
                <div className="text-sm text-text leading-relaxed flex flex-col gap-3">
                  <p>{TERMO_INTRODUCAO}</p>
                  <ul className="list-disc pl-5 flex flex-col gap-1">
                    {TERMO_ITENS.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <div className="bg-surfaceAlt rounded-xl p-4 flex flex-col gap-1 text-textAlt">
                    <p>{TERMO_FINALIDADE}</p>
                    <p>{TERMO_RETENCAO}</p>
                    <p>{TERMO_BASE_LEGAL}</p>
                  </div>
                </div>
              </Dialog.Description>

              <label className="flex items-start gap-3 text-sm text-text cursor-pointer">
                <Checkbox
                  checked={aceito}
                  disabled={!checkboxHabilitado}
                  onCheckedChange={(v) => setAceito(v === true)}
                  className="mt-0.5"
                />
                {TERMO_CHECKBOX_LABEL}
              </label>

              {erro && <p className="text-sm text-error">{erro}</p>}

              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setTela('recusa')}
                  disabled={enviando}
                >
                  Recusar
                </Button>
                <Button
                  onClick={handleAceitar}
                  disabled={!aceito || enviando}
                  className="bg-brand hover:bg-brand/90"
                >
                  {enviando ? 'Enviando...' : 'Li e estou ciente'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <Dialog.Title className="font-display text-lg font-bold text-brand">
                Não é possível continuar
              </Dialog.Title>
              <Dialog.Description asChild>
                <p className="text-sm text-text leading-relaxed">{TERMO_RECUSA_MENSAGEM}</p>
              </Dialog.Description>
              <div className="flex items-center gap-2 text-sm text-textAlt">
                <Mail className="w-4 h-4 text-muted" />
                <span>Ficou com dúvidas? Entre em contato: {TERMO_CONTATO_EMAIL}</span>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setTela('termo')} className="bg-brand hover:bg-brand/90">
                  Revisar e aceitar
                </Button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
