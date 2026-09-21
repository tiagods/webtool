'use client';

import React, { useState, useCallback } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { AberturaFormValues } from '@prolink/shared';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import UploadField from '@/components/UploadField';

// Profissões que exigem registro em conselho profissional
const PROFISSOES_COM_CONSELHO = [
  'médico', 'medico', 'advogado', 'advogada', 'corretor', 'corretora',
  'engenheiro', 'engenheira', 'contador', 'contadora', 'arquiteto', 'arquiteta',
  'psicólogo', 'psicologo', 'psicóloga', 'dentista', 'fisioterapeuta', 'enfermeiro', 'enfermeira',
  'farmacêutico', 'farmaceutico', 'nutricionista', 'veterinário', 'veterinario',
];

function profissaoExigeConselho(profissao: string): boolean {
  const lower = profissao.toLowerCase();
  return PROFISSOES_COM_CONSELHO.some((p) => lower.includes(p));
}

interface DocSpec {
  chave: string;
  label: string;
  hint?: string;
  obrigatorio: boolean;
}

function getDocsSocio(socio: AberturaFormValues['dadosSocios']['socios'][number], idx: number): DocSpec[] {
  const base: DocSpec[] = [
    { chave: `socio_${idx}_rg_frente`,  label: 'RG — Frente',                hint: 'Documento de identidade com foto',            obrigatorio: true },
    { chave: `socio_${idx}_rg_verso`,   label: 'RG — Verso',                 hint: 'Verso do documento de identidade',            obrigatorio: true },
    { chave: `socio_${idx}_cpf`,        label: 'CPF',                        hint: 'Se não constar no RG/CNH',                   obrigatorio: true },
    { chave: `socio_${idx}_residencia`, label: 'Comprovante de Residência',  hint: 'Conta de luz, água ou gás (últimos 3 meses)', obrigatorio: true },
    { chave: `socio_${idx}_irpf_2024`,  label: 'Recibo IRPF 2024',          hint: 'Recibo de entrega da declaração',             obrigatorio: true },
    { chave: `socio_${idx}_irpf_2025`,  label: 'Recibo IRPF 2025',          hint: 'Recibo de entrega da declaração',             obrigatorio: true },
    { chave: `socio_${idx}_titulo`,     label: 'Título de Eleitor',          hint: 'Frente e verso',                             obrigatorio: true },
  ];
  if (socio?.estadoCivil?.startsWith('casado_')) {
    base.push({ chave: `socio_${idx}_certidao_casamento`, label: 'Certidão de Casamento', hint: 'Exigida pelo estado civil informado', obrigatorio: true });
  }
  if (socio?.profissao && profissaoExigeConselho(socio.profissao)) {
    base.push({ chave: `socio_${idx}_conselho`, label: 'Registro em Conselho Profissional', hint: 'CRM, OAB, CRECI, CORE...', obrigatorio: false });
  }
  return base;
}

function getDocsImovel(imovelAlugado: 'sim' | 'nao'): DocSpec[] {
  const docs: DocSpec[] = [
    { chave: 'imovel_iptu', label: 'Cópia do IPTU', hint: 'Folha/espelho com os dados do local', obrigatorio: true },
  ];
  if (imovelAlugado === 'sim') {
    docs.push({ chave: 'imovel_contrato_locacao', label: 'Contrato de Locação', hint: 'Obrigatório para imóvel alugado', obrigatorio: true });
  }
  return docs;
}

function ProgressBar({ sent, total }: { sent: number; total: number }) {
  const pct = total > 0 ? Math.round((sent / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 pt-1">
      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
        <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted whitespace-nowrap">{sent} de {total} enviados</span>
    </div>
  );
}

export default function StepDocumentos() {
  const { control } = useFormContext<AberturaFormValues>();
  const socios      = useWatch({ control, name: 'dadosSocios.socios' }) ?? [];
  const imovelAlugado = useWatch({ control, name: 'endereco.imovelAlugado' }) ?? false;

  // Tab: 0 = Imóvel, 1..N = Sócios
  const [activeTab, setActiveTab] = useState(1);

  // Map chave → s3Key
  const [uploads, setUploads] = useState<Record<string, string>>({});

  const handleChange = useCallback((chave: string, s3Key: string | null) => {
    setUploads((prev) => {
      if (s3Key === null) {
        const next = { ...prev };
        delete next[chave];
        return next;
      }
      return { ...prev, [chave]: s3Key };
    });
  }, []);

  const docsImovel = getDocsImovel(imovelAlugado);
  const sentImovel = docsImovel.filter((d) => uploads[d.chave]).length;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="mb-2">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-brand mb-2">Envio de Documentos</h2>
        <p className="text-muted text-sm md:text-base max-w-2xl">
          Envie cópias digitalizadas ou fotos nítidas. Formatos aceitos: PDF, JPG ou PNG (máx. 10MB por arquivo).
        </p>
      </div>

      {/* Info banner */}
      <div className="bg-sky/5 border border-sky/20 rounded-xl px-5 py-4 flex gap-3 items-start">
        <Info className="w-5 h-5 text-sky flex-shrink-0 mt-0.5" />
        <p className="text-[13px] text-text leading-relaxed">
          Os documentos devem ser de <strong>todos os sócios</strong>. Legibilidade é essencial — documentos ilegíveis atrasam a abertura.
        </p>
      </div>

      {/* Card com abas */}
      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">

        {/* Abas */}
        <div className="flex items-center gap-0 border-b border-border overflow-x-auto px-4 pt-3 pb-0">
          {/* Aba Imóvel (tab 0) */}
          <button
            type="button"
            onClick={() => setActiveTab(0)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
              activeTab === 0 ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-text'
            )}
          >
            Imóvel
            <TabBadge sent={sentImovel} total={docsImovel.length} />
          </button>

          {/* Abas por Sócio */}
          {socios.map((socio, idx) => {
            const tabIdx  = idx + 1;
            const docs    = getDocsSocio(socio, idx);
            const sent    = docs.filter((d) => uploads[d.chave]).length;
            const nome    = socio?.nome?.split(' ')[0] || `Sócio ${tabIdx}`;
            const isActive = activeTab === tabIdx;
            return (
              <button
                key={tabIdx}
                type="button"
                onClick={() => setActiveTab(tabIdx)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                  isActive ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-text'
                )}
              >
                <span className={cn(
                  'w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center',
                  isActive ? 'bg-accent text-white' : 'bg-border/60 text-textAlt'
                )}>
                  {tabIdx}
                </span>
                {nome}
                <TabBadge sent={sent} total={docs.length} />
              </button>
            );
          })}
        </div>

        {/* Conteúdo — Aba Imóvel */}
        {activeTab === 0 && (
          <div className="flex flex-col gap-3 p-5 md:p-6">
            <p className="text-xs text-muted mb-1">
              Documentos da <strong className="text-text">sede da empresa</strong>
            </p>
            {docsImovel.map((doc) => (
              <UploadField
                key={doc.chave}
                chave={doc.chave}
                label={doc.label}
                hint={doc.hint}
                obrigatorio={doc.obrigatorio}
                s3Key={uploads[doc.chave]}
                onChange={(key) => handleChange(doc.chave, key)}
              />
            ))}
            {imovelAlugado === 'nao' && (
              <p className="text-xs text-muted flex items-center gap-1.5 mt-1">
                <Info className="w-3.5 h-3.5 shrink-0" />
                Imóvel próprio/cedido. Se mudou, altere no Passo 2 — Endereço.
              </p>
            )}
            <ProgressBar sent={sentImovel} total={docsImovel.length} />
          </div>
        )}

        {/* Conteúdo — Abas Sócios */}
        {socios.map((socio, idx) => {
          const tabIdx = idx + 1;
          if (activeTab !== tabIdx) return null;
          const docs = getDocsSocio(socio, idx);
          const sent = docs.filter((d) => uploads[d.chave]).length;
          const nome = socio?.nome || `Sócio ${tabIdx}`;
          return (
            <div key={tabIdx} className="flex flex-col gap-3 p-5 md:p-6">
              <p className="text-xs text-muted mb-1">
                Documentos de <strong className="text-text">{nome}</strong>
              </p>
              {docs.map((doc) => (
                <UploadField
                  key={doc.chave}
                  chave={doc.chave}
                  label={doc.label}
                  hint={doc.hint}
                  obrigatorio={doc.obrigatorio}
                  s3Key={uploads[doc.chave]}
                  onChange={(key) => handleChange(doc.chave, key)}
                />
              ))}
              <ProgressBar sent={sent} total={docs.length} />
            </div>
          );
        })}
      </div>

      {/* Card Gov.BR */}
      <div className="bg-surface border border-border rounded-xl px-5 py-4 flex gap-3 items-start">
        <Info className="w-5 h-5 text-sky flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[13px] font-semibold text-text mb-0.5">Senha Gov.BR</p>
          <p className="text-[12px] text-muted leading-relaxed">
            Será necessária a senha do portal <strong>Gov.BR</strong> do titular para assinar digitalmente os documentos de abertura.
            Nossa equipe entrará em contato para orientar esse processo com segurança.
          </p>
        </div>
      </div>
    </div>
  );
}

function TabBadge({ sent, total }: { sent: number; total: number }) {
  return (
    <span className={cn(
      'text-[11px] font-semibold px-1.5 py-0.5 rounded',
      sent === total && total > 0
        ? 'bg-success/10 text-success'
        : sent > 0
        ? 'bg-amber-50 text-amber-700'
        : 'bg-border/60 text-muted'
    )}>
      {sent}/{total}
    </span>
  );
}
