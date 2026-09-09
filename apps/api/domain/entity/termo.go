package entity

// TermoVersaoAtual é a versão vigente do termo de consentimento LGPD. Espelha
// TERMO_VERSAO_ATUAL de @prolink/shared (packages/shared/src/constants/termo.ts):
// o token prolink_aceite só é considerado válido enquanto sua claim versaoTermo
// for igual a este valor.
const TermoVersaoAtual = "v1.0"
