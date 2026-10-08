package middleware

import (
	"github.com/labstack/echo/v4"

	"github.com/tiagods/webtool/apps/backend/infrastructure/httperrors"
)

// Limitador é o contrato de limitador que o middleware precisa: permite ou
// recusa a requisição identificada pela chave (IP do cliente). Declarado aqui
// (lado consumidor) para o middleware não depender da implementação concreta
// de infrastructure/ratelimit.
type Limitador interface {
	Permitir(chave string) bool
}

// RateLimit limita as requisições por IP do cliente (primeiro valor de
// X-Forwarded-For, via c.RealIP). Excedido o limite, responde 429.
func RateLimit(rl Limitador) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if !rl.Permitir(c.RealIP()) {
				return httperrors.TooManyRequests("muitas requisições — tente novamente em instantes")
			}
			return next(c)
		}
	}
}
