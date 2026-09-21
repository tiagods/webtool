//go:build integration

package infrastructure

import (
	"net/http"
	"testing"

	"github.com/tiagods/webtool/apps/backend/infrastructure/auth"
	testhelpers "github.com/tiagods/webtool/apps/backend/infrastructure/testhelpers"
)

func TestIntegrationBorda_PayloadInvalido400(t *testing.T) {
	d := testhelpers.SetupIntegration(t)
	aceiteCookie := criarAceite(d, t)
	sessCookie := criarSessao(d, t, aceiteCookie)
	resp := req(d, t, http.MethodPost, "/api/submit",
		`{"dadosEmpresa":{"tipoConstituicao":"ltda"}}`,
		[]*http.Cookie{aceiteCookie, sessCookie})
	assertStatus(t, resp, http.StatusBadRequest)
}

func TestIntegrationBorda_SessaoInexistente403(t *testing.T) {
	d := testhelpers.SetupIntegration(t)
	aceiteCookie := criarAceite(d, t)
	fakeCookie := &http.Cookie{Name: auth.CookieSessao, Value: "invalido"}
	resp := req(d, t, http.MethodGet, "/api/draft", "", []*http.Cookie{aceiteCookie, fakeCookie})
	assertStatus(t, resp, http.StatusForbidden)
}

func TestIntegrationBorda_SessaoEnviada409(t *testing.T) {
	d := testhelpers.SetupIntegration(t)
	aceiteCookie := criarAceite(d, t)
	sessCookie := criarSessao(d, t, aceiteCookie)
	payload := casoAbertura(t, "full_ltda_valido")
	req(d, t, http.MethodPost, "/api/draft", payload, []*http.Cookie{aceiteCookie, sessCookie})
	resp := req(d, t, http.MethodPost, "/api/submit", payload, []*http.Cookie{aceiteCookie, sessCookie})
	assertStatus(t, resp, http.StatusOK)
	resp = req(d, t, http.MethodPost, "/api/submit", payload, []*http.Cookie{aceiteCookie, sessCookie})
	assertStatus(t, resp, http.StatusConflict)
}

func TestIntegrationBorda_DuplaCriacaoSessao(t *testing.T) {
	d := testhelpers.SetupIntegration(t)
	aceiteCookie := criarAceite(d, t)
	resp1 := req(d, t, http.MethodPost, "/api/session", "", []*http.Cookie{aceiteCookie})
	assertStatus(t, resp1, http.StatusOK)
	resp2 := req(d, t, http.MethodPost, "/api/session", "", []*http.Cookie{aceiteCookie})
	assertStatus(t, resp2, http.StatusOK)
}

func TestIntegrationBorda_DeleteLimpa(t *testing.T) {
	d := testhelpers.SetupIntegration(t)
	aceiteCookie := criarAceite(d, t)
	sessCookie := criarSessao(d, t, aceiteCookie)
	seedS3Object(d, t, sessCookie.Value+"/documentos/contrato.pdf", "application/pdf", "%PDF-1.4 test")
	resp := req(d, t, http.MethodDelete, "/api/session", "", []*http.Cookie{aceiteCookie, sessCookie})
	assertStatus(t, resp, http.StatusOK)
}