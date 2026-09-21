//go:build integration

package infrastructure

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/tiagods/webtool/apps/backend/domain/entity"
	"github.com/tiagods/webtool/apps/backend/infrastructure/auth"
	testhelpers "github.com/tiagods/webtool/apps/backend/infrastructure/testhelpers"
)

func TestIntegrationAbertura_FluxoFeliz(t *testing.T) {
	d := testhelpers.SetupIntegration(t)
	ctx := context.Background()

	// POST /api/aceite-termo
	resp := req(d, t, http.MethodPost, "/api/aceite-termo", `{"versaoTermo":"v1.0","ip":"127.0.0.1","userAgent":"test"}`, nil)
	assertStatus(t, resp, http.StatusOK)
	aceiteCookie := extrairCookie(resp, auth.CookieAceite)

	// POST /api/session
	resp = req(d, t, http.MethodPost, "/api/session", "", []*http.Cookie{aceiteCookie})
	assertStatus(t, resp, http.StatusOK)
	sessCookie := extrairCookie(resp, auth.CookieSessao)

	// POST /api/draft com payload de abertura
	payload := casoAbertura(t, "full_ltda_valido")
	resp = req(d, t, http.MethodPost, "/api/draft", payload, []*http.Cookie{aceiteCookie, sessCookie})
	assertStatus(t, resp, http.StatusOK)

	// POST /api/upload-url
	body := `{"campo":"contrato_social","nome":"contrato_social.pdf","contentType":"application/pdf"}`
	resp = req(d, t, http.MethodPost, "/api/upload-url", body, []*http.Cookie{aceiteCookie, sessCookie})
	assertStatus(t, resp, http.StatusOK)
	var uploadRes struct{ URL string }
	mustDecodeJSON(t, resp, &uploadRes)
	if uploadRes.URL == "" {
		t.Fatal("upload-url não devolveu URL")
	}

	// PUT real no S3 via URL presigned
	putReq, _ := http.NewRequestWithContext(ctx, http.MethodPut, uploadRes.URL,
		strings.NewReader("%PDF-1.4 conteudo de teste"))
	putReq.Header.Set("Content-Type", "application/pdf")
	putResp, err := http.DefaultClient.Do(putReq)
	if err != nil || putResp.StatusCode != http.StatusOK {
		t.Fatalf("PUT presigned: status %d, err %v", putResp.StatusCode, err)
	}
	putResp.Body.Close()

	// POST /api/draft com uploadedCampo para confirmar o upload
	resp = req(d, t, http.MethodPost, "/api/draft", `{"uploadedCampo":"contrato_social","contentType":"application/pdf"}`, []*http.Cookie{aceiteCookie, sessCookie})
	assertStatus(t, resp, http.StatusOK)

	// GET /api/draft — deve ter o payload e documentosKeys
	resp = req(d, t, http.MethodGet, "/api/draft", "", []*http.Cookie{aceiteCookie, sessCookie})
	assertStatus(t, resp, http.StatusOK)
	var draftRes struct {
		Payload        json.RawMessage `json:"payload"`
		DocumentosKeys map[string]string `json:"documentosKeys"`
	}
	mustDecodeJSON(t, resp, &draftRes)
	if draftRes.Payload == nil {
		t.Fatal("draft sem payload")
	}
	if draftRes.DocumentosKeys["contrato_social"] == "" {
		t.Fatal("draft sem contrato_social nos documentosKeys")
	}

	// POST /api/submit
	resp = req(d, t, http.MethodPost, "/api/submit", payload, []*http.Cookie{aceiteCookie, sessCookie})
	assertStatus(t, resp, http.StatusOK)
	var submitRes struct{ Protocolo string }
	mustDecodeJSON(t, resp, &submitRes)
	if !strings.HasPrefix(submitRes.Protocolo, "PRO-") {
		t.Fatalf("protocolo inválido: %q", submitRes.Protocolo)
	}

	// Cookie de sessão expirado
	sessExpired := extrairCookie(resp, auth.CookieSessao)
	if sessExpired == nil || sessExpired.MaxAge >= 0 || sessExpired.Value != "" {
		t.Fatal("cookie de sessão deveria ter sido expirado")
	}

	// Mensagem chegou na fila SQS
	msg := receberMensagemSQS(d, t)
	if msg == nil {
		t.Fatal("nenhuma mensagem recebida na fila SQS")
	}
	var pubMsg entity.SubmissaoMessage
	if err := json.Unmarshal([]byte(*msg.Body), &pubMsg); err != nil {
		t.Fatalf("decodificar mensagem SQS: %v", err)
	}
	if pubMsg.FormType != entity.FormAbertura {
		t.Fatalf("formType = %q, esperava %q", pubMsg.FormType, entity.FormAbertura)
	}
	if pubMsg.Tipo != entity.TipoLtda {
		t.Fatalf("tipo = %q, esperava %q", pubMsg.Tipo, entity.TipoLtda)
	}
	deletarMensagemSQS(d, t, *msg.ReceiptHandle)
}

func TestIntegrationAbertura_SubmitSLU(t *testing.T) {
	d := testhelpers.SetupIntegration(t)

	aceiteCookie := criarAceite(d, t)
	sessCookie := criarSessao(d, t, aceiteCookie)

	payload := casoAbertura(t, "full_slu_valido")
	resp := req(d, t, http.MethodPost, "/api/draft", payload, []*http.Cookie{aceiteCookie, sessCookie})
	assertStatus(t, resp, http.StatusOK)

	resp = req(d, t, http.MethodPost, "/api/submit", payload, []*http.Cookie{aceiteCookie, sessCookie})
	assertStatus(t, resp, http.StatusOK)
	var submitRes struct{ Protocolo string }
	mustDecodeJSON(t, resp, &submitRes)
	if !strings.HasPrefix(submitRes.Protocolo, "PRO-") {
		t.Fatalf("protocolo = %q", submitRes.Protocolo)
	}
}

func TestIntegrationAbertura_ProtocoloSequencial(t *testing.T) {
	d := testhelpers.SetupIntegration(t)

	payload := casoAbertura(t, "full_ltda_valido")

	var prot1, prot2 string
	for i := 0; i < 2; i++ {
		aceiteCookie := criarAceite(d, t)
		sessCookie := criarSessao(d, t, aceiteCookie)

		req(d, t, http.MethodPost, "/api/draft", payload, []*http.Cookie{aceiteCookie, sessCookie})
		resp := req(d, t, http.MethodPost, "/api/submit", payload, []*http.Cookie{aceiteCookie, sessCookie})
		assertStatus(t, resp, http.StatusOK)
		var res struct{ Protocolo string }
		mustDecodeJSON(t, resp, &res)

		if i == 0 {
			prot1 = res.Protocolo
		} else {
			prot2 = res.Protocolo
		}

		// Limpa a mensagem da fila
		msg := receberMensagemSQS(d, t)
		if msg != nil {
			deletarMensagemSQS(d, t, *msg.ReceiptHandle)
		}
	}

	if prot1 >= prot2 {
		t.Fatalf("protocolo1=%q não é menor que protocolo2=%q", prot1, prot2)
	}
}