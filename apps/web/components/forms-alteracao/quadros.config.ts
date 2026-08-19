import type { QuadroAlteracao, AlteracaoFormValues } from '@prolink/shared';

export type QuadroKey = 'q01' | 'q02' | 'q03' | 'q04' | 'q05' | 'q06' | 'q07' | 'q08' | 'q09';

export const QUADRO_KEY: Record<QuadroAlteracao, QuadroKey> = {
  nome_empresarial: 'q01',
  objeto_social: 'q02',
  endereco: 'q03',
  quadro_societario: 'q04',
  capital_social: 'q05',
  redistribuicao_capital: 'q06',
  natureza_juridica: 'q07',
  administracao: 'q08',
  outras_alteracoes: 'q09',
};

export const QUADRO_LABEL: Record<QuadroAlteracao, string> = {
  nome_empresarial: 'Razão Social',
  objeto_social: 'Objeto Social',
  endereco: 'Mudança de Endereço da Sede',
  quadro_societario: 'Quadro Societário',
  capital_social: 'Alteração do Capital Social',
  redistribuicao_capital: 'Redistribuição do Capital entre Sócios',
  natureza_juridica: 'Transformação da Natureza Jurídica',
  administracao: 'Alteração da Administração',
  outras_alteracoes: 'Outras Alterações',
};

// Agrupamento do Passo 2 — mesma ordem/agrupamento de docs/ficha-alteracao.md
export const QUADRO_GROUPS: { title: string; quadros: QuadroAlteracao[] }[] = [
  { title: 'Dados da Empresa', quadros: ['nome_empresarial', 'objeto_social'] },
  { title: 'Endereço', quadros: ['endereco'] },
  { title: 'Quadro Societário', quadros: ['quadro_societario', 'capital_social', 'redistribuicao_capital'] },
  { title: 'Administração e Estrutura', quadros: ['administracao', 'natureza_juridica'] },
  { title: 'Outras', quadros: ['outras_alteracoes'] },
];

export const QUADRO_ORDER: QuadroAlteracao[] = QUADRO_GROUPS.flatMap((g) => g.quadros);

type QuadroDefault<K extends QuadroKey> = NonNullable<AlteracaoFormValues[K]>;

export function getQuadroDefault(codigo: QuadroAlteracao): QuadroDefault<QuadroKey> {
  switch (codigo) {
    case 'nome_empresarial':
      return { nomeEmpresarial1: '', nomeEmpresarial2: '', nomeEmpresarial3: '' };
    case 'objeto_social':
      return { novoObjetoSocial: '' };
    case 'endereco':
      return { logradouro: '', bairro: '', municipio: '', estado: '', cep: '', iptu: '' };
    case 'quadro_societario':
      return { membros: [] };
    case 'capital_social':
      return { valorCapitalSocial: 0, tipoAlteracao: 'aumento', valorIntegralizacao: undefined, especificarIntegralizacao: '' };
    case 'redistribuicao_capital':
      return { socios: [] };
    case 'natureza_juridica':
      return { tipoTransformacao: 'ltda_para_simples', especificar: '' };
    case 'administracao':
      return { administradores: [] };
    case 'outras_alteracoes':
      return { descricao: '' };
  }
}
