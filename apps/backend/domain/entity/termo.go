package entity

// TermoVersaoAtual é a versão vigente do termo de consentimento LGPD. O token
// prolink_aceite só é válido enquanto a claim versaoTermo for igual a este
// valor; o front mantém a sua própria cópia — divergência vira 400.
const TermoVersaoAtual = "v1.0"
