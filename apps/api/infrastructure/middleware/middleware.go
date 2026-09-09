// Package middleware reúne os middlewares HTTP (Echo) da API: correlation id na
// requisição, tradução de erro → resposta JSON, rate limit por IP e os guards de
// aceite/sessão. É a única parte de infrastructure que conhece o Echo; os
// handlers de adapter/web montam o router a partir daqui.
package middleware

import (
	"errors"
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"

	"github.com/tiagods/webtool/apps/api/domain/service"
	"github.com/tiagods/webtool/apps/api/infrastructure/httperrors"
	"github.com/tiagods/webtool/apps/api/infrastructure/logger"
	"github.com/tiagods/webtool/apps/api/infrastructure/requestcontext"
)

// RequestContext gera (ou propaga, via header X-Cid) um correlation id e o anexa
// ao context.Context da requisição para logging e rastreio.
func RequestContext(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		req := c.Request()

		cid := req.Header.Get(requestcontext.HeaderCID)
		if cid == "" {
			cid = uuid.NewString()
		}

		rc := requestcontext.RequestContext{
			CID:    cid,
			Tenant: req.Header.Get(requestcontext.HeaderTenant),
		}

		c.Response().Header().Set(requestcontext.HeaderCID, cid)
		c.SetRequest(req.WithContext(requestcontext.With(req.Context(), rc)))

		return next(c)
	}
}

// HTTPErrorHandler traduz qualquer erro retornado por um handler numa resposta
// JSON `{"error": "<mensagem>"}`. A causa interna nunca vai no corpo — só no log.
func HTTPErrorHandler(err error, c echo.Context) {
	if c.Response().Committed {
		return
	}
	ctx := c.Request().Context()
	status, message := statusAndMessage(err)

	if status >= http.StatusInternalServerError {
		logger.Error(ctx, err, "requisição falhou")
	} else {
		logger.Warn(ctx, err, "requisição rejeitada")
	}

	_ = c.JSON(status, errorResponse{Error: message})
}

type errorResponse struct {
	Error string `json:"error"`
}

// statusAndMessage extrai o par (status, mensagem segura) de err, reconhecendo
// os erros sentinela do domínio, *httperrors.HTTPError e *echo.HTTPError.
// Default: 500 genérico.
func statusAndMessage(err error) (int, string) {
	if status, message, ok := statusDeDominio(err); ok {
		return status, message
	}

	var he *httperrors.HTTPError
	if errors.As(err, &he) {
		return he.Status, he.Message
	}

	var ee *echo.HTTPError
	if errors.As(err, &ee) {
		if msg, ok := ee.Message.(string); ok {
			return ee.Code, msg
		}
		return ee.Code, http.StatusText(ee.Code)
	}

	return http.StatusInternalServerError, "erro interno"
}

// statusDeDominio mapeia os erros sentinela de service para status HTTP e uma
// mensagem segura ao cliente. ok=false quando err não é um erro de domínio.
func statusDeDominio(err error) (status int, message string, ok bool) {
	switch {
	case errors.Is(err, service.ErrVersaoTermoInvalida):
		return http.StatusBadRequest, "versaoTermo inválida", true
	case errors.Is(err, service.ErrCampoDocumentoInvalido):
		return http.StatusBadRequest, "campo inválido", true
	case errors.Is(err, service.ErrContentTypeDocumentoInvalido):
		return http.StatusBadRequest,
			"contentType deve ser application/pdf, image/jpeg ou image/png", true
	case errors.Is(err, service.ErrAceiteAusente):
		return http.StatusForbidden, "termo de ciência não aceito", true
	case errors.Is(err, service.ErrSessaoInvalida):
		return http.StatusForbidden, "sessão inválida ou expirada", true
	case errors.Is(err, service.ErrSessaoEnviada):
		return http.StatusConflict,
			"sessão já enviada — exclusão de dados protocolados exige contato direto com a empresa", true
	default:
		return 0, "", false
	}
}
