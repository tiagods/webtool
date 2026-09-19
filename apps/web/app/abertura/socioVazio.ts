import type { AberturaFormValues } from '@prolink/shared';

type Socio = AberturaFormValues['dadosSocios']['socios'][number];

export function socioVazio(): Partial<Socio> {
  return {
    nome: '',
    pis: '',
    cpf: '',
    rg: '',
    nacionalidade: '',
    profissao: '',
    proLabore: undefined,
    telefoneCelular: '',
    telefoneFixo: '',
    email: '',
    estadoCivil: undefined,
    nomeMae: '',
    nomePai: '',
    cepRegistro: '',
    logradouroRegistro: '',
    numeroRegistro: '',
    complementoRegistro: '',
    bairroRegistro: '',
    registroConselho: '',
    teveParticipacaoSocietaria: false,
    cnpjParticipacao: '',
  };
}
