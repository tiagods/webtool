package handler

import (
	"io"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/tiagods/webtool/apps/backend/adapter/web/presenter"
	"github.com/tiagods/webtool/apps/backend/infrastructure/httperrors"
	"github.com/tiagods/webtool/apps/backend/infrastructure/middleware"
)

// PostSubmit finaliza a Ficha de Abertura. Protegida por GuardAceite +
// GuardSessao(FormAbertura), que publicam o sessionID no contexto. Payload
// inválido → 400 `{error:"Payload inválido", issues:[...]}`; sucesso → 200
// `{protocolo}` e expira o cookie de sessão (a sessão já foi marcada enviada).
func (h *Handlers) PostSubmit(c echo.Context) error {
	sessionID := c.Get(middleware.ContextSessionID).(string)

	raw, err := io.ReadAll(c.Request().Body)
	if err != nil {
		return httperrors.BadRequest("corpo da requisição inválido")
	}

	protocolo, issues, err := h.submit.Submeter(c.Request().Context(), sessionID, raw)
	if err != nil {
		return err
	}
	if len(issues) > 0 {
		return c.JSON(http.StatusBadRequest, presenter.NewPayloadInvalido(issues))
	}

	c.SetCookie(h.cookies.ExpirarSessao())
	return c.JSON(http.StatusOK, presenter.NewSubmit(protocolo))
}
