package handler

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/tiagods/webtool/apps/backend/adapter/web/presenter"
	"github.com/tiagods/webtool/apps/backend/domain/entity"
	"github.com/tiagods/webtool/apps/backend/infrastructure/auth"
	"github.com/tiagods/webtool/apps/backend/infrastructure/httperrors"
	"github.com/tiagods/webtool/apps/backend/infrastructure/middleware"
)

// PostUploadURL valida o pedido, cria (ou reaproveita) a sessão de abertura e
// devolve uma URL PUT pré-assinada para upload direto ao S3. Protegida apenas
// por GuardAceite. Emite o cookie prolink_session quando a sessão é nova.
func (h *Handlers) PostUploadURL(c echo.Context) error {
	var req presenter.UploadURLRequest
	if err := c.Bind(&req); err != nil {
		return httperrors.BadRequest("corpo da requisição inválido")
	}

	// Valida antes de criar a sessão: pedido malformado não deixa item órfão.
	if err := h.upload.ValidarPedido(req.Campo, req.ContentType); err != nil {
		return err
	}

	ctx := c.Request().Context()
	sessao, err := h.sessao.CriarOuObter(ctx, entity.FormAbertura, middleware.LerCookie(c, auth.CookieSessao))
	if err != nil {
		return err
	}

	url, err := h.upload.PresignarDocumento(ctx, sessao.SessionID, req.Campo, req.ContentType)
	if err != nil {
		return err
	}

	if sessao.Nova {
		c.SetCookie(h.cookies.Sessao(sessao.Token))
	}
	return c.JSON(http.StatusOK, presenter.NewUploadURL(url))
}
