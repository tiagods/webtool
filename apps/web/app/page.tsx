import { Home, Pencil } from 'lucide-react';
import SelecaoFichaCard from '@/components/SelecaoFichaCard';

export default function Home_() {
  return (
    <div className="min-h-screen flex flex-col bg-surfaceAlt">
      <header className="h-16 flex items-center justify-between shrink-0 px-4 md:px-8 lg:px-20 bg-brand">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center rounded-md shrink-0 bg-accent size-8">
            <div className="rounded-[3px] shrink-0 bg-white size-4" />
          </div>
          <span className="font-display font-bold text-white text-[17px] tracking-[-0.3px]">
            Prolink Contábil
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <div className="rounded-full shrink-0 bg-sky size-2" />
          <span className="text-white/60 text-[13px]">Ficha Cadastral Digital</span>
        </div>
      </header>

      <main className="grow flex flex-col items-center justify-center px-4 py-12 md:px-8 lg:px-20">
        <div className="max-w-[760px] w-full flex flex-col items-center mb-10 md:mb-14">
          <span className="tracking-[0.08em] uppercase mb-4 text-center font-semibold text-accent text-[13px]">
            Prolink Contábil
          </span>
          <h1 className="mb-3.5 text-center font-display font-bold text-brand text-[28px] md:text-[40px] leading-tight tracking-[-0.8px]">
            Ficha Cadastral Digital
          </h1>
          <p className="text-center text-muted text-base leading-6">
            Selecione o tipo de ficha para iniciar o preenchimento do formulário.
          </p>
        </div>

        <div className="w-full max-w-[760px] flex flex-col md:flex-row gap-4 md:gap-5">
          <SelecaoFichaCard
            icon={<Home className="size-6" strokeWidth={1.8} />}
            iconBgClassName="bg-accent/10"
            accentClassName="text-accent"
            label="Abertura"
            title="Ficha Cadastral de Abertura"
            description="Registre uma nova empresa com todo o amparo jurídico e contábil. Preencha os dados em 6 passos simples."
            footerText="6 passos · ~10 min"
            ctaLabel="Iniciar Abertura"
            href="/abertura"
          />
          <SelecaoFichaCard
            icon={<Pencil className="size-6" strokeWidth={1.8} />}
            iconBgClassName="bg-success/10"
            accentClassName="text-success"
            label="Alteração"
            title="Ficha Cadastral de Alteração"
            description="Solicite alterações nos dados cadastrais de uma empresa já existente. Rápido, seguro e sem burocracia."
            footerText="Processo simplificado"
            ctaLabel="Iniciar Alteração"
            href="/alteracao"
            disabled
            badge="Em breve"
          />
        </div>
      </main>
    </div>
  );
}
