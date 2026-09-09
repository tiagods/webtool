package handler

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/tiagods/webtool/apps/backend/adapter/web/presenter"
	"github.com/tiagods/webtool/apps/backend/infrastructure/httperrors"
	"github.com/tiagods/webtool/apps/backend/infrastructure/middleware"
)

// GetDraft devolve o rascunho salvo da sessão de abertura. Protegida por
// GuardAceite + GuardSessao(FormAbertura), que publicam o sessionID no contexto.
func (h *Handlers) GetDraft(c echo.Context) error {
	sessionID := c.Get(middleware.ContextSessionID).(string)

	rascunho, err := h.rascunho.Buscar(c.Request().Context(), sessionID)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, presenter.DraftFromRascunho(rascunho))
}

// PostDraft salva o rascunho parcial do formulário ou confirma um upload,
// escolhendo a variante pela presença de `uploadedCampo` (string) no corpo.
func (h *Handlers) PostDraft(c echo.Context) error {
	sessionID := c.Get(middleware.ContextSessionID).(string)

	raw, err := io.ReadAll(c.Request().Body)
	if err != nil {
		return httperrors.BadRequest("corpo da requisição inválido")
	}

	var conf presenter.UploadConfirmacao
	_ = json.Unmarshal(raw, &conf)
	if conf.UploadedCampo != nil {
		if err := h.rascunho.ConfirmarUpload(c.Request().Context(), sessionID, *conf.UploadedCampo, conf.ContentType); err != nil {
			return err
		}
		return c.JSON(http.StatusOK, presenter.NewOK())
	}

	issues, err := h.rascunho.Salvar(c.Request().Context(), sessionID, raw)
	if err != nil {
		return err
	}
	if len(issues) > 0 {
		return c.JSON(http.StatusBadRequest, presenter.NewPayloadInvalido(issues))
	}
	return c.JSON(http.StatusOK, presenter.NewOK())
}
