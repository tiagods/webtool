package web_test

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"go.uber.org/mock/gomock"

	"github.com/tiagods/webtool/apps/backend/domain/entity"
	"github.com/tiagods/webtool/apps/backend/infrastructure/auth"
)

// aberturaValida devolve o payload `input` de um caso aceito da suíte de
// caracterização da validação (domain/validation/testdata).
func aberturaValida(t *testing.T, nome string) string {
	t.Helper()
	caminho := filepath.Join("..", "..", "domain", "validation", "testdata", "casos_abertura.json")
	dados, err := os.ReadFile(caminho)
	if err != nil {
		t.Fatalf("ler %s: %v", caminho, err)
	}
	var casos []struct {
		Nome  string          `json:"nome"`
		Input json.RawMessage `json:"input"`
	}
	if err := json.Unmarshal(dados, &casos); err != nil {
		t.Fatalf("decodificar casos: %v", err)
	}
	for _, c := range casos {
		if c.Nome == nome {
			return string(c.Input)
		}
	}
	t.Fatalf("caso %q não encontrado", nome)
	return ""
}

func TestPostSubmit(t *testing.T) {
	t.Parallel()

	t.Run("sem cookie de aceite → 403", func(t *testing.T) {
		amb := novoAmbiente(t)
		resp := amb.req(t, http.MethodPost, "/api/submit", "{}")
		if resp.StatusCode != http.StatusForbidden {
			t.Fatalf("status = %d, esperado 403", resp.StatusCode)
		}
	})

	t.Run("com aceite mas sem sessão válida → 403", func(t *testing.T) {
		amb := novoAmbiente(t)
		resp := amb.req(t, http.MethodPost, "/api/submit", "{}", amb.cookieAceiteValido(t))
		if resp.StatusCode != http.StatusForbidden {
			t.Fatalf("status = %d, esperado 403", resp.StatusCode)
		}
	})

	t.Run("sessão já enviada → 409 (divergência intencional vs Node 403)", func(t *testing.T) {
		amb := novoAmbiente(t)
		amb.abertura.semeia(&entity.Rascunho{SessionID: "s9", Status: entity.StatusEnviado})
		tok, _ := amb.tokens.AssinarSessao("s9")

		resp := amb.req(t, http.MethodPost, "/api/submit", "{}",
			amb.cookieAceiteValido(t), &http.Cookie{Name: auth.CookieSessao, Value: tok})
		if resp.StatusCode != http.StatusConflict {
			t.Fatalf("status = %d, esperado 409", resp.StatusCode)
		}
	})

	t.Run("payload inválido → 400 com corpo do Node", func(t *testing.T) {
		amb := novoAmbiente(t)
		ck := amb.cookieSessaoValida(t, "s1")

		resp := amb.req(t, http.MethodPost, "/api/submit",
			`{"dadosEmpresa":{"tipoConstituicao":"ltda"}}`, amb.cookieAceiteValido(t), ck)
		if resp.StatusCode != http.StatusBadRequest {
			t.Fatalf("status = %d, esperado 400", resp.StatusCode)
		}
		body := corpoJSON(t, resp)
		if body["error"] != "Payload inválido" {
			t.Errorf("error = %v", body["error"])
		}
		if issues, ok := body["issues"].([]any); !ok || len(issues) == 0 {
			t.Errorf("issues = %v", body["issues"])
		}
		// publisher e storage são mocks sem EXPECT → qualquer chamada falharia o teste.
		if amb.abertura.enviadoProtocolo != "" {
			t.Error("payload inválido não deveria disparar marcarEnviado")
		}
	})

	t.Run("caminho feliz → 200 {protocolo} + cookie de sessão expirado", func(t *testing.T) {
		amb := novoAmbiente(t)
		ck := amb.cookieSessaoValida(t, "s1")
		amb.abertura.itens["s1"].DocumentosKeys = map[string]string{"rg": "s1/documentos/rg.pdf"}

		var pubMsg entity.SubmissaoMessage
		amb.protocolo.EXPECT().Proximo(gomock.Any(), entity.ProtocoloPrefixAbertura).Return("PRO-2026-000042", nil)
		amb.storage.EXPECT().Copy(gomock.Any(), "s1/documentos/rg.pdf", "protocolos/PRO-2026-000042/rg.pdf").Return(nil)
		amb.publisher.EXPECT().Publish(gomock.Any(), gomock.Any()).DoAndReturn(
			func(_ context.Context, m entity.SubmissaoMessage) error { pubMsg = m; return nil })
		amb.storage.EXPECT().DeletePrefix(gomock.Any(), "s1/").Return(nil)

		resp := amb.req(t, http.MethodPost, "/api/submit",
			aberturaValida(t, "full_ltda_valido"), amb.cookieAceiteValido(t), ck)
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("status = %d", resp.StatusCode)
		}
		if corpoJSON(t, resp)["protocolo"] != "PRO-2026-000042" {
			t.Errorf("protocolo divergente")
		}
		if pubMsg.FormType != entity.FormAbertura || pubMsg.Tipo != entity.TipoLtda || pubMsg.Protocolo != "PRO-2026-000042" {
			t.Errorf("mensagem publicada = %+v", pubMsg)
		}
		if amb.abertura.enviadoProtocolo != "PRO-2026-000042" || amb.abertura.enviadoTipo != entity.TipoLtda {
			t.Errorf("marcarEnviado = (%q, %q)", amb.abertura.enviadoProtocolo, amb.abertura.enviadoTipo)
		}
		if ck := cookieChamado(resp, auth.CookieSessao); ck == nil || ck.MaxAge >= 0 {
			t.Errorf("cookie de sessão não foi expirado: %+v", ck)
		}
	})

	t.Run("corpo malformado → 400 (divergência intencional vs Node 500)", func(t *testing.T) {
		amb := novoAmbiente(t)
		ck := amb.cookieSessaoValida(t, "s1")

		resp := amb.req(t, http.MethodPost, "/api/submit", `{"dadosEmpresa":`,
			amb.cookieAceiteValido(t), ck)
		if resp.StatusCode != http.StatusBadRequest {
			t.Fatalf("status = %d, esperado 400", resp.StatusCode)
		}
	})
}
