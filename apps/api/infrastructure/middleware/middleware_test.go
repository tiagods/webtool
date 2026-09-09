package middleware

import (
	"errors"
	"net/http"
	"testing"

	"github.com/labstack/echo/v4"

	"github.com/tiagods/webtool/apps/api/infrastructure/httperrors"
)

func TestStatusAndMessage(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		err         error
		wantStatus  int
		wantMessage string
	}{
		{
			name:        "HTTPError de domínio",
			err:         httperrors.Conflict("sessão já enviada"),
			wantStatus:  http.StatusConflict,
			wantMessage: "sessão já enviada",
		},
		{
			name:        "HTTPError embrulhado nunca vaza a causa interna",
			err:         httperrors.Wrap(http.StatusBadRequest, "payload inválido", errors.New("json: unexpected EOF")),
			wantStatus:  http.StatusBadRequest,
			wantMessage: "payload inválido",
		},
		{
			name:        "echo.HTTPError com mensagem string",
			err:         echo.NewHTTPError(http.StatusNotFound, "rota não encontrada"),
			wantStatus:  http.StatusNotFound,
			wantMessage: "rota não encontrada",
		},
		{
			name:        "erro genérico vira 500 sem detalhe",
			err:         errors.New("boom interno com detalhe sensível"),
			wantStatus:  http.StatusInternalServerError,
			wantMessage: "erro interno",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			status, message := statusAndMessage(tt.err)
			if status != tt.wantStatus {
				t.Errorf("status = %d, esperado %d", status, tt.wantStatus)
			}
			if message != tt.wantMessage {
				t.Errorf("message = %q, esperado %q", message, tt.wantMessage)
			}
		})
	}
}
