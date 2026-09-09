package handler

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/tiagods/webtool/apps/backend/adapter/web/presenter"
	"github.com/tiagods/webtool/apps/backend/infrastructure/httperrors"
)

// PostAceiteTermo registra o aceite do termo LGPD e emite o cookie prolink_aceite.
// Versão de termo diferente da vigente ⇒ 400 (service.ErrVersaoTermoInvalida).
func (h *Handlers) PostAceiteTermo(c echo.Context) error {
	var req presenter.AceiteRequest
	if err := c.Bind(&req); err != nil {
		return httperrors.BadRequest("corpo da requisição inválido")
	}

	token, err := h.aceite.RegistrarAceite(
		c.Request().Context(),
		strings.TrimSpace(req.VersaoTermo),
		valorOuPadrao(c.RealIP(), "unknown"),
		valorOuPadrao(c.Request().UserAgent(), "unknown"),
	)
	if err != nil {
		return err
	}

	c.SetCookie(h.cookies.Aceite(token))
	return c.JSON(http.StatusOK, presenter.NewOK())
}
