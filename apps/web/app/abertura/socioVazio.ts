import type { AberturaFormValues } from '@prolink/shared';

type Socio = AberturaFormValues['dadosSocios']['socios'][number];

export function socioVazio(): Partial<Socio> {
  return {
    nome: '',
    pis: '',
    profissao: '',
    proLabore: undefined,
    telefoneCelular: '',
    telefoneFixo: '',
    email: '',
    estadoCivil: undefined,
    teveParticipacaoSocietaria: false,
    cnpjParticipacao: '',
  };
}
