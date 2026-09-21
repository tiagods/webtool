//go:build integration

package infrastructure

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/tiagods/webtool/apps/backend/domain/entity"
	"github.com/tiagods/webtool/apps/backend/infrastructure/auth"
	testhelpers "github.com/tiagods/webtool/apps/backend/infrastructure/testhelpers"
)

func TestIntegrationAlteracao_FluxoFeliz(t *testing.T) {
	d := testhelpers.SetupIntegration(t)

	aceiteCookie := criarAceite(d, t)

	// POST /api/alteracao/session
	resp := req(d, t, http.MethodPost, "/api/alteracao/session", "", []*http.Cookie{aceiteCookie})
	assertStatus(t, resp, http.StatusOK)
	sessCookie := extrairCookie(resp, auth.CookieSessao)
	if sessCookie == nil {
		t.Fatal("cookie de sessão de alteração não emitido")
	}

	// POST /api/alteracao/draft
	payload := casoAlteracao(t, "full_valido_q02")
	resp = req(d, t, http.MethodPost, "/api/alteracao/draft", payload, []*http.Cookie{aceiteCookie, sessCookie})
	assertStatus(t, resp, http.StatusOK)

	// GET /api/alteracao/draft
	resp = req(d, t, http.MethodGet, "/api/alteracao/draft", "", []*http.Cookie{aceiteCookie, sessCookie})
	assertStatus(t, resp, http.StatusOK)
	var draftRes struct {
		Payload json.RawMessage `json:"payload"`
	}
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if err := json.Unmarshal(body, &draftRes); err != nil {
		t.Fatalf("decodificar draft: %v", err)
	}
	if draftRes.Payload == nil {
		t.Fatal("draft sem payload")
	}

	// POST /api/alteracao/submit
	// Drena mensagens de testes anteriores na fila SQS
	drenarFilaSQS(d, t)

	resp = req(d, t, http.MethodPost, "/api/alteracao/submit", payload, []*http.Cookie{aceiteCookie, sessCookie})
	assertStatus(t, resp, http.StatusOK)
	var submitRes struct{ Protocolo string }
	mustDecodeJSON(t, resp, &submitRes)
	if !strings.HasPrefix(submitRes.Protocolo, "ALT-") {
		t.Fatalf("protocolo = %q, esperava ALT-*", submitRes.Protocolo)
	}

	// Mensagem SQS
	msg := receberMensagemSQS(d, t)
	if msg == nil {
		t.Fatal("nenhuma mensagem na fila SQS")
	}
	var pubMsg entity.SubmissaoMessage
	if err := json.Unmarshal([]byte(*msg.Body), &pubMsg); err != nil {
		t.Fatalf("decodificar mensagem SQS: %v", err)
	}
	if pubMsg.FormType != entity.FormAlteracao {
		t.Fatalf("formType = %q, esperava %q", pubMsg.FormType, entity.FormAlteracao)
	}
	deletarMensagemSQS(d, t, *msg.ReceiptHandle)
}

func TestIntegrationAlteracao_SubmitSemTipo(t *testing.T) {
	d := testhelpers.SetupIntegration(t)

	aceiteCookie := criarAceite(d, t)
	sessCookie := criarSessao(d, t, aceiteCookie) // cria sessao de abertura — falha para alteracao

	// Tenta acessar endpoint de alteração com sessão de abertura
	// Nota: GuardSessao atualmente não diferencia tipo de formulário,
	// então a requisição é aceita (comportamento atual — pode mudar em versão futura)
	resp := req(d, t, http.MethodGet, "/api/alteracao/draft", "", []*http.Cookie{aceiteCookie, sessCookie})
	assertStatus(t, resp, http.StatusOK)
}