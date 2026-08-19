'use client';

import { useRouter } from 'next/navigation';
import { useFormContext, useWatch } from 'react-hook-form';
import { AlteracaoFormValues, QuadroAlteracao } from '@prolink/shared';

import { Label } from '@/components/ui/label';
import { FormField, FormItem, FormControl, FormMessage, FormLabel } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Pencil } from 'lucide-react';
import { QUADRO_ORDER, QUADRO_LABEL } from './quadros.config';

function EditarLink({ step }: { step: number }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(`?step=${step}`)}
      className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent/80 transition-colors"
    >
      <Pencil className="w-3.5 h-3.5" />
      Editar
    </button>
  );
}

function ResumoQuadro({ codigo, data }: { codigo: QuadroAlteracao; data: Record<string, unknown> }) {
  switch (codigo) {
    case 'nome_empresarial':
      return (
        <>
          <p className="text-sm text-text">1ª Opção: {String(data.nomeEmpresarial1 ?? '-')}</p>
          <p className="text-sm text-text">2ª Opção: {String(data.nomeEmpresarial2 ?? '-')}</p>
          <p className="text-sm text-text">3ª Opção: {String(data.nomeEmpresarial3 ?? '-')}</p>
        </>
      );
    case 'objeto_social':
      return <p className="text-sm text-text">{String(data.novoObjetoSocial ?? '-')}</p>;
    case 'endereco':
      return (
        <p className="text-sm text-text">
          {String(data.logradouro ?? '-')}, {String(data.numero ?? '-')} — {String(data.bairro ?? '-')},{' '}
          {String(data.municipio ?? '-')}/{String(data.estado ?? '-')} — CEP: {String(data.cep ?? '-')} — IPTU:{' '}
          {String(data.iptu ?? '-')}
        </p>
      );
    case 'quadro_societario': {
      const membros = (data.membros as Array<Record<string, unknown>>) ?? [];
      return (
        <div className="flex flex-col gap-2">
          {membros.map((m, idx) => (
            <p key={idx} className="text-sm text-text">
              {m.tipo === 'cedente' ? 'Sai' : 'Entra'}: {String(m.nomeCompleto ?? '-')} — CPF: {String(m.cpf ?? '-')} —{' '}
              {String(m.percentualParticipacao ?? 0)}%
            </p>
          ))}
          {membros.length === 0 && <p className="text-sm text-muted">Nenhum sócio adicionado.</p>}
        </div>
      );
    }
    case 'capital_social':
      return (
        <p className="text-sm text-text">
          {data.tipoAlteracao === 'aumento' ? 'Aumento' : 'Redução'} para R$ {Number(data.valorCapitalSocial ?? 0).toFixed(2)}
        </p>
      );
    case 'redistribuicao_capital': {
      const socios = (data.socios as Array<Record<string, unknown>>) ?? [];
      return (
        <div className="flex flex-col gap-2">
          {socios.map((s, idx) => (
            <p key={idx} className="text-sm text-text">
              {String(s.nomeSocio ?? '-')} — {String(s.percentual ?? 0)}% — R$ {Number(s.valor ?? 0).toFixed(2)}
            </p>
          ))}
          {socios.length === 0 && <p className="text-sm text-muted">Nenhum sócio adicionado.</p>}
        </div>
      );
    }
    case 'natureza_juridica':
      return (
        <p className="text-sm text-text">
          {data.tipoTransformacao === 'ltda_para_simples' && 'Ltda → Simples Limitada'}
          {data.tipoTransformacao === 'simples_para_ltda' && 'Simples Limitada → Ltda'}
          {data.tipoTransformacao === 'outras' && `Outras: ${String(data.especificar ?? '-')}`}
        </p>
      );
    case 'administracao': {
      const administradores = (data.administradores as string[]) ?? [];
      return <p className="text-sm text-text">{administradores.filter(Boolean).join(', ') || '-'}</p>;
    }
    case 'outras_alteracoes':
      return <p className="text-sm text-text">{String(data.descricao ?? '-')}</p>;
    default:
      return null;
  }
}

export default function StepRevisao() {
  const { control } = useFormContext<AlteracaoFormValues>();

  const identificacao = useWatch({ control, name: 'identificacao' });
  const quadros = useWatch({ control, name: 'quadros' }) ?? [];
  const formValues = useWatch({ control });

  const selecionados = QUADRO_ORDER.filter((codigo) => quadros.includes(codigo));

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-2">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-brand mb-2">Revisão Final</h2>
        <p className="text-muted text-sm md:text-base max-w-2xl">
          Confira atentamente todas as informações antes de confirmar o envio.
        </p>
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
        {/* Identificação */}
        <div className="p-5 md:p-7 border-b border-border">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-brand text-[15px]">Identificação da Empresa</h3>
            <EditarLink step={1} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted">CNPJ</Label>
              <span className="text-sm font-medium text-text">{identificacao?.cnpj || '-'}</span>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted">Razão Social Atual</Label>
              <span className="text-sm font-medium text-text">{identificacao?.razaoSocial || '-'}</span>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label className="text-xs text-muted">Endereço Atual</Label>
              <span className="text-sm font-medium text-text">
                {identificacao?.enderecoAtual?.logradouro
                  ? `${identificacao.enderecoAtual.logradouro} — ${identificacao.enderecoAtual.bairro}, ${identificacao.enderecoAtual.municipio}/${identificacao.enderecoAtual.estado} — CEP: ${identificacao.enderecoAtual.cep}`
                  : '-'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted">Situação Cadastral</Label>
              <span className="text-sm font-medium text-text uppercase">{identificacao?.situacao || '-'}</span>
            </div>
          </div>
        </div>

        {/* Quadros selecionados */}
        <div className="p-5 md:p-7 border-b border-border bg-surfaceAlt/30">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-brand text-[15px]">Quadros Selecionados ({selecionados.length})</h3>
            <EditarLink step={2} />
          </div>
          {selecionados.length === 0 && <p className="text-sm text-muted">Nenhum quadro selecionado.</p>}
        </div>

        {selecionados.map((codigo, idx) => {
          const key = { nome_empresarial: 'q01', objeto_social: 'q02', endereco: 'q03', quadro_societario: 'q04', capital_social: 'q05', redistribuicao_capital: 'q06', natureza_juridica: 'q07', administracao: 'q08', outras_alteracoes: 'q09' }[codigo] as keyof AlteracaoFormValues;
          const data = (formValues?.[key] as Record<string, unknown>) ?? {};

          return (
            <div
              key={codigo}
              className={`p-5 md:p-7 border-b border-border ${idx % 2 === 1 ? 'bg-surfaceAlt/30' : ''}`}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-brand text-[15px]">{QUADRO_LABEL[codigo]}</h3>
                <EditarLink step={3} />
              </div>
              <ResumoQuadro codigo={codigo} data={data} />
            </div>
          );
        })}

        {/* Termo */}
        <div className="p-5 md:p-7 bg-surfaceAlt border-t border-border mt-auto">
          <FormField
            control={control}
            name="aceite"
            render={({ field }) => (
              <FormItem className="flex items-start space-x-3">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} className="mt-1" />
                </FormControl>
                <div className="grid gap-1.5 leading-none">
                  <FormLabel className="text-sm font-medium leading-normal cursor-pointer">
                    Declaro que li e estou de acordo com o Termo de Consentimento e Tratamento de Dados (LGPD).
                  </FormLabel>
                  <p className="text-xs text-muted leading-relaxed">
                    Todos os dados submetidos serão utilizados exclusivamente para o processo de avaliação e alteração contratual da empresa, conforme nossas normatizações legais.
                  </p>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />
        </div>
      </div>
    </div>
  );
}
