package web_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"go.uber.org/mock/gomock"

	"github.com/tiagods/webtool/apps/backend/adapter/web"
	"github.com/tiagods/webtool/apps/backend/domain/entity"
	"github.com/tiagods/webtool/apps/backend/domain/ports/outbound/mocks"
	"github.com/tiagods/webtool/apps/backend/domain/service"
	"github.com/tiagods/webtool/apps/backend/infrastructure/auth"
	"github.com/tiagods/webtool/apps/backend/infrastructure/ratelimit"
)

type ambiente struct {
	srv        *httptest.Server
	abertura   *fakeRascunhoRepo
	alteracao  *fakeRascunhoRepo
	aceiteRepo *mocks.MockAceiteRepository
	storage    *mocks.MockDocumentoStorage
	protocolo  *mocks.MockProtocoloCounter
	publisher  *mocks.MockSubmissaoPublisher
	tokens     *auth.JWTTokenService
}

func novoAmbiente(t *testing.T) *ambiente {
	t.Helper()
	ctrl := gomock.NewController(t)
	abertura := novoFakeRascunhoRepo()
	alteracao := novoFakeRascunhoRepo()
	aceiteRepo := mocks.NewMockAceiteRepository(ctrl)
	storage := mocks.NewMockDocumentoStorage(ctrl)
	protocolo := mocks.NewMockProtocoloCounter(ctrl)
	publisher := mocks.NewMockSubmissaoPublisher(ctrl)
	tokens := auth.NewJWTTokenService("segredo-de-teste", time.Hour)

	e := web.NewRouter(web.Deps{
		Aceite:            service.NewAceiteService(aceiteRepo, tokens),
		Sessao:            service.NewSessaoService(abertura, alteracao, tokens, storage),
		Rascunho:          service.NewRascunhoService(abertura),
		Upload:            service.NewUploadService(storage, service.PresignUploadExpiraEm),
		Submit:            service.NewSubmitService(abertura, protocolo, publisher, storage),
		RascunhoAlteracao: service.NewAlteracaoRascunhoService(alteracao),
		SubmitAlteracao:   service.NewAlteracaoSubmitService(protocolo, storage, publisher, alteracao),
		Tokens:            tokens,
		Cookies:           auth.NewCookieBuilder(false, time.Hour),
		RateLimit:         ratelimit.NewFixedWindow(ratelimit.PadraoLimite, ratelimit.PadraoJanela),
	})

	srv := httptest.NewServer(e)
	t.Cleanup(srv.Close)
	return &ambiente{
		srv: srv, abertura: abertura, alteracao: alteracao, aceiteRepo: aceiteRepo, storage: storage,
		protocolo: protocolo, publisher: publisher, tokens: tokens,
	}
}

func (a *ambiente) req(t *testing.T, metodo, caminho, corpo string, cookies ...*http.Cookie) *http.Response {
	t.Helper()
	r, err := http.NewRequest(metodo, a.srv.URL+caminho, strings.NewReader(corpo))
	if err != nil {
		t.Fatalf("montar request: %v", err)
	}
	r.Header.Set("Content-Type", "application/json")
	for _, ck := range cookies {
		r.AddCookie(ck)
	}
	resp, err := a.srv.Client().Do(r)
	if err != nil {
		t.Fatalf("executar request: %v", err)
	}
	t.Cleanup(func() { _ = resp.Body.Close() })
	return resp
}

// cookieSessaoValida semeia um rascunho ativo para sessionID na tabela de
// abertura e devolve o cookie prolink_session correspondente.
func (a *ambiente) cookieSessaoValida(t *testing.T, sessionID string) *http.Cookie {
	t.Helper()
	a.abertura.semeia(&entity.Rascunho{SessionID: sessionID, Status: entity.StatusRascunho})
	tok, err := a.tokens.AssinarSessao(sessionID)
	if err != nil {
		t.Fatalf("assinar sessão: %v", err)
	}
	return &http.Cookie{Name: auth.CookieSessao, Value: tok}
}

// cookieSessaoAlteracaoValida semeia um rascunho ativo para sessionID na tabela
// de alteração e devolve o cookie prolink_session correspondente.
func (a *ambiente) cookieSessaoAlteracaoValida(t *testing.T, sessionID string) *http.Cookie {
	t.Helper()
	a.alteracao.semeia(&entity.Rascunho{SessionID: sessionID, Status: entity.StatusRascunho})
	tok, err := a.tokens.AssinarSessao(sessionID)
	if err != nil {
		t.Fatalf("assinar sessão: %v", err)
	}
	return &http.Cookie{Name: auth.CookieSessao, Value: tok}
}

func (a *ambiente) cookieAceiteValido(t *testing.T) *http.Cookie {
	t.Helper()
	tok, err := a.tokens.AssinarAceite("sess-aceite", entity.TermoVersaoAtual)
	if err != nil {
		t.Fatalf("assinar aceite: %v", err)
	}
	return &http.Cookie{Name: auth.CookieAceite, Value: tok}
}

func cookieChamado(resp *http.Response, nome string) *http.Cookie {
	for _, ck := range resp.Cookies() {
		if ck.Name == nome {
			return ck
		}
	}
	return nil
}

func TestPostAceiteTermo(t *testing.T) {
	t.Parallel()
	amb := novoAmbiente(t)

	t.Run("versão vigente → 200 + cookie prolink_aceite", func(t *testing.T) {
		amb.aceiteRepo.EXPECT().Put(gomock.Any(), gomock.Any()).Return(nil)
		resp := amb.req(t, http.MethodPost, "/api/aceite-termo",
			`{"versaoTermo":"`+entity.TermoVersaoAtual+`"}`)

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("status = %d", resp.StatusCode)
		}
		ck := cookieChamado(resp, auth.CookieAceite)
		if ck == nil {
			t.Fatal("cookie prolink_aceite ausente")
		}
		if !ck.HttpOnly || ck.SameSite != http.SameSiteLaxMode || ck.Secure || ck.Path != "/" {
			t.Errorf("atributos do cookie inesperados: %+v", ck)
		}
		if ck.MaxAge != 365*24*60*60 {
			t.Errorf("MaxAge = %d", ck.MaxAge)
		}
	})

	t.Run("versão inválida → 400", func(t *testing.T) {
		resp := amb.req(t, http.MethodPost, "/api/aceite-termo", `{"versaoTermo":"v0.1"}`)
		if resp.StatusCode != http.StatusBadRequest {
			t.Fatalf("status = %d, esperado 400", resp.StatusCode)
		}
	})
}

func TestPostSession(t *testing.T) {
	t.Parallel()
	amb := novoAmbiente(t)

	t.Run("sem cookie de aceite → 403", func(t *testing.T) {
		resp := amb.req(t, http.MethodPost, "/api/session", "")
		if resp.StatusCode != http.StatusForbidden {
			t.Fatalf("status = %d, esperado 403", resp.StatusCode)
		}
	})

	t.Run("com aceite → 200 + cookie de sessão + item de rascunho", func(t *testing.T) {
		resp := amb.req(t, http.MethodPost, "/api/session", "", amb.cookieAceiteValido(t))
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("status = %d", resp.StatusCode)
		}
		ck := cookieChamado(resp, auth.CookieSessao)
		if ck == nil || ck.MaxAge != 3600 {
			t.Fatalf("cookie de sessão inesperado: %+v", ck)
		}
		if len(amb.abertura.itens) != 1 {
			t.Errorf("esperava 1 item de rascunho, tem %d", len(amb.abertura.itens))
		}
	})
}

func TestDeleteSession(t *testing.T) {
	t.Parallel()

	t.Run("sem cookie → 403", func(t *testing.T) {
		amb := novoAmbiente(t)
		resp := amb.req(t, http.MethodDelete, "/api/session", "")
		if resp.StatusCode != http.StatusForbidden {
			t.Fatalf("status = %d, esperado 403", resp.StatusCode)
		}
	})

	t.Run("sessão enviada → 409", func(t *testing.T) {
		amb := novoAmbiente(t)
		amb.abertura.semeia(&entity.Rascunho{SessionID: "s1", Status: entity.StatusEnviado})
		tok, _ := amb.tokens.AssinarSessao("s1")

		resp := amb.req(t, http.MethodDelete, "/api/session", "",
			&http.Cookie{Name: auth.CookieSessao, Value: tok})
		if resp.StatusCode != http.StatusConflict {
			t.Fatalf("status = %d, esperado 409", resp.StatusCode)
		}
	})

	t.Run("sessão ativa → 200 + limpeza + cookie expirado", func(t *testing.T) {
		amb := novoAmbiente(t)
		amb.abertura.semeia(&entity.Rascunho{SessionID: "s1", Status: entity.StatusRascunho})
		amb.storage.EXPECT().DeletePrefix(gomock.Any(), "s1/").Return(nil)
		tok, _ := amb.tokens.AssinarSessao("s1")

		resp := amb.req(t, http.MethodDelete, "/api/session", "",
			&http.Cookie{Name: auth.CookieSessao, Value: tok})

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("status = %d", resp.StatusCode)
		}
		if _, ok := amb.abertura.itens["s1"]; ok {
			t.Error("rascunho não foi apagado")
		}
		if ck := cookieChamado(resp, auth.CookieSessao); ck == nil || ck.MaxAge >= 0 {
			t.Errorf("cookie de sessão não foi expirado: %+v", ck)
		}
	})
}

func TestRateLimit(t *testing.T) {
	t.Parallel()
	amb := novoAmbiente(t)
	aceite := amb.cookieAceiteValido(t)

	var ultimo int
	for i := 0; i < ratelimit.PadraoLimite+1; i++ {
		resp := amb.req(t, http.MethodPost, "/api/session", "", aceite)
		ultimo = resp.StatusCode
	}
	if ultimo != http.StatusTooManyRequests {
		t.Fatalf("última requisição: status = %d, esperado 429", ultimo)
	}
}

func TestRespostaOKEhJSON(t *testing.T) {
	t.Parallel()
	amb := novoAmbiente(t)
	amb.aceiteRepo.EXPECT().Put(gomock.Any(), gomock.Any()).Return(nil)
	resp := amb.req(t, http.MethodPost, "/api/aceite-termo",
		`{"versaoTermo":"`+entity.TermoVersaoAtual+`"}`)

	var corpo map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&corpo); err != nil {
		t.Fatalf("decodificar corpo: %v", err)
	}
	if corpo["ok"] != true {
		t.Errorf("corpo = %v", corpo)
	}
}
