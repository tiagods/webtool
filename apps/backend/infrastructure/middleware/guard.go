package middleware

import (
	"github.com/labstack/echo/v4"

	"github.com/tiagods/webtool/apps/backend/domain/entity"
	"github.com/tiagods/webtool/apps/backend/domain/ports/outbound"
	"github.com/tiagods/webtool/apps/backend/domain/service"
	"github.com/tiagods/webtool/apps/backend/infrastructure/auth"
)

// ContextSessionID é a chave sob a qual GuardSessao publica o sessionID validado
// no echo.Context, para os handlers consumirem via c.Get.
const ContextSessionID = "sessionID"

// GuardAceite exige um cookie prolink_aceite válido para a versão vigente do
// termo. Falha com service.ErrAceiteAusente (→ 403 no HTTPErrorHandler).
func GuardAceite(sessao *service.SessaoService) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if err := sessao.VerificarAceite(LerCookie(c, auth.CookieAceite)); err != nil {
				return err
			}
			return next(c)
		}
	}
}

// GuardSessao exige um cookie prolink_session válido cuja sessão ainda exista na
// tabela de formType e não tenha sido enviada. Publica o sessionID no contexto.
// Falha com service.ErrSessaoInvalida (→ 403) ou service.ErrSessaoEnviada (→ 409).
func GuardSessao(sessao *service.SessaoService, tokens outbound.TokenService, formType entity.FormType) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			sessionID, err := tokens.VerificarSessao(LerCookie(c, auth.CookieSessao))
			if err != nil {
				return service.ErrSessaoInvalida
			}
			if err := sessao.RequireSessao(c.Request().Context(), formType, sessionID); err != nil {
				return err
			}
			c.Set(ContextSessionID, sessionID)
			return next(c)
		}
	}
}

// LerCookie devolve o valor do cookie nome, ou "" se ausente.
func LerCookie(c echo.Context, nome string) string {
	ck, err := c.Cookie(nome)
	if err != nil {
		return ""
	}
	return ck.Value
}
