// Enums e constantes compartilhadas entre Abertura e Alteração.
// Centralizados aqui para evitar divergência entre os dois formulários.

export const TIPO_CONSTITUICAO = ['ltda', 'slu'] as const;

// Estado civil base usado na Ficha de Abertura (7 valores).
// A Ficha de Alteração estende com 'divorciado' (8 valores) — ver ESTADO_CIVIL_ALTERACAO.
export const ESTADO_CIVIL_BASE = [
  'solteiro',
  'casado_comunhao_parcial',
  'casado_comunhao_universal',
  'casado_separacao_bens',
  'casado_separacao_obrigatoria',
  'viuvo',
  'separado_judicialmente',
] as const;

// Estado civil da Ficha de Alteração: base + 'divorciado'.
export const ESTADO_CIVIL_ALTERACAO = [
  ...ESTADO_CIVIL_BASE,
  'divorciado',
] as const;