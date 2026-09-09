package handler

import (
	"io"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/tiagods/webtool/apps/backend/adapter/web/presenter"
	"github.com/tiagods/webtool/apps/backend/infrastructure/httperrors"
	"github.com/tiagods/webtool/apps/backend/infrastructure/middleware"
)

// PostAlteracaoSubmit finaliza a Ficha de Alteração. Protegida por GuardAceite +
// GuardSessao(FormAlteracao). Payload inválido → 400 `{error:"Payload inválido",
// issues:[...]}`; sucesso → 200 `{protocolo}` e expira o cookie de sessão (a
// sessão já foi marcada enviada pelo serviço).
func (h *Handlers) PostAlteracaoSubmit(c echo.Context) error {
	sessionID := c.Get(middleware.ContextSessionID).(string)

	raw, err := io.ReadAll(c.Request().Body)
	if err != nil {
		return httperrors.BadRequest("corpo da requisição inválido")
	}

	protocolo, issues, err := h.submitAlteracao.Submeter(c.Request().Context(), sessionID, raw)
	if err != nil {
		return err
	}
	if len(issues) > 0 {
		return c.JSON(http.StatusBadRequest, presenter.NewPayloadInvalido(issues))
	}

	c.SetCookie(h.cookies.ExpirarSessao())
	return c.JSON(http.StatusOK, presenter.NewSubmit(protocolo))
}
