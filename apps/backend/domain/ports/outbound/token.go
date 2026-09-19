package outbound

// TokenService assina e verifica os JWT HS256 usados nos cookies de autenticação
// (prolink_aceite e prolink_session). É implementado pela infraestrutura sobre
// uma biblioteca de JWT — o domínio não conhece o formato do token.
//
// Os tokens usam HS256 e claims iat/exp em segundos; o segredo e o formato são
// compartilhados com o verificador do front.
type TokenService interface {
	// AssinarAceite emite o token do cookie prolink_aceite: claims
	// {sub: sessionID, versaoTermo, iat, exp}, validade de 1 ano.
	AssinarAceite(sessionID, versaoTermo string) (string, error)

	// AssinarSessao emite o token do cookie prolink_session: claims
	// {sub: sessionID, iat, exp}, validade = SESSION_EXPIRY_SECONDS.
	AssinarSessao(sessionID string) (string, error)

	// VerificarAceite valida a assinatura e a expiração do token de aceite e
	// devolve a claim versaoTermo. Erro se o token for inválido ou expirado.
	VerificarAceite(token string) (versaoTermo string, err error)

	// VerificarSessao valida a assinatura e a expiração do token de sessão e
	// devolve a claim sub (sessionID). Erro se o token for inválido ou expirado.
	VerificarSessao(token string) (sessionID string, err error)
}
