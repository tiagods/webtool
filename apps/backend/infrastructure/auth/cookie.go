package auth

import (
	"net/http"
	"time"
)

// Nomes dos cookies de autenticação, idênticos aos do Node (apps/api/lib/auth.ts).
const (
	CookieAceite = "prolink_aceite"
	CookieSessao = "prolink_session"
)

// aceiteMaxAgeSegundos é a validade em segundos do cookie prolink_aceite (1 ano).
const aceiteMaxAgeSegundos = int(aceiteMaxAge / time.Second)

// CookieBuilder monta os cookies de autenticação com atributos idênticos aos do
// Node: HttpOnly, SameSite=Lax, Path=/, e Secure apenas em produção.
type CookieBuilder struct {
	secure        bool
	sessionExpiry time.Duration
}

// NewCookieBuilder recebe se o ambiente é produção (define a flag Secure) e a
// validade do cookie de sessão (SESSION_EXPIRY_SECONDS).
func NewCookieBuilder(secure bool, sessionExpiry time.Duration) *CookieBuilder {
	return &CookieBuilder{secure: secure, sessionExpiry: sessionExpiry}
}

// Aceite monta o cookie prolink_aceite (validade de 1 ano).
func (b *CookieBuilder) Aceite(token string) *http.Cookie {
	return b.base(CookieAceite, token, aceiteMaxAgeSegundos)
}

// Sessao monta o cookie prolink_session (validade = SESSION_EXPIRY_SECONDS).
func (b *CookieBuilder) Sessao(token string) *http.Cookie {
	return b.base(CookieSessao, token, int(b.sessionExpiry/time.Second))
}

// ExpirarSessao monta o cookie que remove o prolink_session do navegador
// (MaxAge negativo → Max-Age: 0), espelhando o `maxAge: 0` do DELETE no Node.
func (b *CookieBuilder) ExpirarSessao() *http.Cookie {
	return &http.Cookie{
		Name:   CookieSessao,
		Value:  "",
		Path:   "/",
		MaxAge: -1,
	}
}

func (b *CookieBuilder) base(nome, valor string, maxAge int) *http.Cookie {
	return &http.Cookie{
		Name:     nome,
		Value:    valor,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   b.secure,
		SameSite: http.SameSiteLaxMode,
	}
}
