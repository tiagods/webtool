import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Prolink | Alteração Contratual',
  description: 'Solicite a alteração contratual da sua empresa pela Prolink Contábil.',
};

export default function AlteracaoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surfaceAlt font-sans text-text flex flex-col">
      {/* Topbar Corporativa */}
      <header className="h-14 bg-brand flex items-center px-4 md:px-8 shrink-0 border-b border-white/10 z-30 sticky top-0 shadow-sm">
        <div className="w-full max-w-[1020px] mx-auto flex items-center px-4 md:px-0">
          <div className="flex items-center gap-3">
            {/* Logo box */}
            <div className="w-7 h-7 bg-white rounded flex items-center justify-center shadow-sm">
              <div className="w-4 h-4 bg-accent rounded-sm" />
            </div>
            <span className="text-white font-display font-semibold text-[15px] tracking-wide">
              Prolink Contábil
            </span>
          </div>

          <div className="ml-auto hidden sm:flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-sky/80" />
            <span className="text-white/60 text-[13px] font-medium tracking-wide">
              Alteração Contratual — Formulário Digital
            </span>
          </div>
        </div>
      </header>

      {/* Container Principal do Formulário */}
      <main className="flex-1 w-full max-w-[1020px] mx-auto bg-surface shadow-sm sm:border-x sm:border-b sm:border-border rounded-b-xl flex flex-col relative pb-0 mb-4 h-full min-h-[calc(100vh-56px)]">
        {children}
      </main>
    </div>
  );
}
