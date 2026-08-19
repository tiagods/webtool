'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { AlteracaoFormValues } from '@prolink/shared';

import { QUADRO_ORDER } from './quadros.config';
import Q01NomeEmpresarial from './quadros/Q01NomeEmpresarial';
import Q02ObjetoSocial from './quadros/Q02ObjetoSocial';
import Q03Endereco from './quadros/Q03Endereco';
import Q04QuadroSocietario from './quadros/Q04QuadroSocietario';
import Q05CapitalSocial from './quadros/Q05CapitalSocial';
import Q06Redistribuicao from './quadros/Q06Redistribuicao';
import Q07NaturezaJuridica from './quadros/Q07NaturezaJuridica';
import Q08Administracao from './quadros/Q08Administracao';
import Q09Outras from './quadros/Q09Outras';

const QUADRO_COMPONENT: Record<(typeof QUADRO_ORDER)[number], React.ComponentType> = {
  nome_empresarial: Q01NomeEmpresarial,
  objeto_social: Q02ObjetoSocial,
  endereco: Q03Endereco,
  quadro_societario: Q04QuadroSocietario,
  capital_social: Q05CapitalSocial,
  redistribuicao_capital: Q06Redistribuicao,
  natureza_juridica: Q07NaturezaJuridica,
  administracao: Q08Administracao,
  outras_alteracoes: Q09Outras,
};

export default function StepNovosDados() {
  const { control } = useFormContext<AlteracaoFormValues>();
  const quadros = useWatch({ control, name: 'quadros' }) ?? [];

  const selecionados = QUADRO_ORDER.filter((codigo) => quadros.includes(codigo));

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-2">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-brand mb-2">Novos Dados</h2>
        <p className="text-muted text-sm md:text-base max-w-2xl">
          Preencha os novos dados para cada quadro selecionado no passo anterior.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {selecionados.map((codigo) => {
          const QuadroComponent = QUADRO_COMPONENT[codigo];
          return <QuadroComponent key={codigo} />;
        })}
      </div>
    </div>
  );
}
