package handler

import (
	"io"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/tiagods/webtool/apps/api/adapter/web/presenter"
	"github.com/tiagods/webtool/apps/api/infrastructure/httperrors"
	"github.com/tiagods/webtool/apps/api/infrastructure/middleware"
)

// GetAlteracaoDraft devolve o rascunho salvo da sessão de alteração. Protegida
// por GuardAceite + GuardSessao(FormAlteracao), que publicam o sessionID no
// contexto. Corpo `{payload}` (sem documentosKeys — o formulário não tem upload).
func (h *Handlers) GetAlteracaoDraft(c echo.Context) error {
	sessionID := c.Get(middleware.ContextSessionID).(string)

	rascunho, err := h.rascunhoAlteracao.Buscar(c.Request().Context(), sessionID)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, presenter.NewAlteracaoDraft(rascunho))
}

// PostAlteracaoDraft salva o rascunho parcial do formulário de alteração.
// Payload inválido → 400 `{error:"Payload inválido", issues:[...]}`.
func (h *Handlers) PostAlteracaoDraft(c echo.Context) error {
	sessionID := c.Get(middleware.ContextSessionID).(string)

	raw, err := io.ReadAll(c.Request().Body)
	if err != nil {
		return httperrors.BadRequest("corpo da requisição inválido")
	}

	issues, err := h.rascunhoAlteracao.Salvar(c.Request().Context(), sessionID, raw)
	if err != nil {
		return err
	}
	if len(issues) > 0 {
		return c.JSON(http.StatusBadRequest, presenter.NewPayloadInvalido(issues))
	}
	return c.JSON(http.StatusOK, presenter.NewOK())
}
