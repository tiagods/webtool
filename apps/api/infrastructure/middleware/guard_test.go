package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"go.uber.org/mock/gomock"

	"github.com/tiagods/webtool/apps/api/domain/entity"
	"github.com/tiagods/webtool/apps/api/domain/ports/outbound/mocks"
	"github.com/tiagods/webtool/apps/api/domain/service"
	"github.com/tiagods/webtool/apps/api/infrastructure/auth"
)

func TestGuardSessao(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	tokens := auth.NewJWTTokenService("segredo-de-teste", time.Hour)
	abertura := mocks.NewMockRascunhoRepository(ctrl)
	abertura.EXPECT().Get(gomock.Any(), "ativa").
		Return(&entity.Rascunho{SessionID: "ativa", Status: entity.StatusRascunho}, nil).AnyTimes()
	abertura.EXPECT().Get(gomock.Any(), "enviada").
		Return(&entity.Rascunho{SessionID: "enviada", Status: entity.StatusEnviado}, nil).AnyTimes()
	abertura.EXPECT().Get(gomock.Any(), "fantasma").Return(nil, nil).AnyTimes()

	sessao := service.NewSessaoService(abertura, mocks.NewMockRascunhoRepository(ctrl),
		tokens, mocks.NewMockDocumentoStorage(ctrl))

	mw := GuardSessao(sessao, tokens, entity.FormAbertura)
	handlerFinal := func(c echo.Context) error {
		return c.String(http.StatusOK, c.Get(ContextSessionID).(string))
	}

	tokenDe := func(id string) string {
		tok, _ := tokens.AssinarSessao(id)
		return tok
	}

	tests := []struct {
		nome       string
		cookie     *http.Cookie
		querStatus int
	}{
		{"sem cookie", nil, http.StatusForbidden},
		{"token lixo", &http.Cookie{Name: auth.CookieSessao, Value: "nao-e-jwt"}, http.StatusForbidden},
		{"sessão inexistente", &http.Cookie{Name: auth.CookieSessao, Value: tokenDe("fantasma")}, http.StatusForbidden},
		{"sessão enviada", &http.Cookie{Name: auth.CookieSessao, Value: tokenDe("enviada")}, http.StatusConflict},
		{"sessão ativa", &http.Cookie{Name: auth.CookieSessao, Value: tokenDe("ativa")}, http.StatusOK},
	}

	e := echo.New()
	e.HTTPErrorHandler = HTTPErrorHandler

	for _, tt := range tests {
		t.Run(tt.nome, func(t *testing.T) {
			t.Parallel()
			req := httptest.NewRequest(http.MethodPost, "/api/draft", nil)
			if tt.cookie != nil {
				req.AddCookie(tt.cookie)
			}
			rec := httptest.NewRecorder()
			c := e.NewContext(req, rec)

			if err := mw(handlerFinal)(c); err != nil {
				e.HTTPErrorHandler(err, c)
			}
			if rec.Code != tt.querStatus {
				t.Fatalf("status = %d, esperado %d", rec.Code, tt.querStatus)
			}
			if tt.querStatus == http.StatusOK && rec.Body.String() != "ativa" {
				t.Errorf("sessionID no contexto = %q", rec.Body.String())
			}
		})
	}
}
