package middleware

import (
	"github.com/labstack/echo/v4"

	"github.com/tiagods/webtool/apps/backend/infrastructure/httperrors"
	"github.com/tiagods/webtool/apps/backend/infrastructure/ratelimit"
)

// RateLimit limita as requisições por IP do cliente (primeiro valor de
// X-Forwarded-For, via c.RealIP). Excedido o limite, responde 429.
func RateLimit(rl *ratelimit.FixedWindow) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if !rl.Permitir(c.RealIP()) {
				return httperrors.TooManyRequests("muitas requisições — tente novamente em instantes")
			}
			return next(c)
		}
	}
}
