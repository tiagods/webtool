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

// alteracaoValida devolve o payload `input` de um caso da suíte de
// caracterização da validação de Alteração (domain/validation/testdata).
func alteracaoValida(t *testing.T, nome string) string {
	t.Helper()
	caminho := filepath.Join("..", "..", "domain", "validation", "testdata", "casos_alteracao.json")
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

func TestGetAlteracaoDraft(t *testing.T) {
	t.Parallel()

	t.Run("sem cookie de aceite → 403", func(t *testing.T) {
		amb := novoAmbiente(t)
		resp := amb.req(t, http.MethodGet, "/api/alteracao/draft", "")
		if resp.StatusCode != http.StatusForbidden {
			t.Fatalf("status = %d, esperado 403", resp.StatusCode)
		}
	})

	t.Run("cookie de sessão de abertura não vale para alteração → 403", func(t *testing.T) {
		amb := novoAmbiente(t)
		ck := amb.cookieSessaoValida(t, "s1") // semeia só na tabela de abertura
		resp := amb.req(t, http.MethodGet, "/api/alteracao/draft", "", amb.cookieAceiteValido(t), ck)
		if resp.StatusCode != http.StatusForbidden {
			t.Fatalf("status = %d, esperado 403", resp.StatusCode)
		}
	})

	t.Run("com sessão de alteração → 200 {payload} (sem documentosKeys)", func(t *testing.T) {
		amb := novoAmbiente(t)
		ck := amb.cookieSessaoAlteracaoValida(t, "s1")
		amb.alteracao.itens["s1"].Payload = json.RawMessage(`{"quadros":["objeto_social"]}`)

		resp := amb.req(t, http.MethodGet, "/api/alteracao/draft", "", amb.cookieAceiteValido(t), ck)
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("status = %d", resp.StatusCode)
		}
		body := corpoJSON(t, resp)
		if body["payload"].(map[string]any)["quadros"].([]any)[0] != "objeto_social" {
			t.Errorf("payload = %v", body["payload"])
		}
		if _, tem := body["documentosKeys"]; tem {
			t.Error("resposta de alteração não deve trazer documentosKeys")
		}
	})

	t.Run("rascunho recém-criado → 200 com payload null", func(t *testing.T) {
		amb := novoAmbiente(t)
		ck := amb.cookieSessaoAlteracaoValida(t, "s2")
		resp := amb.req(t, http.MethodGet, "/api/alteracao/draft", "", amb.cookieAceiteValido(t), ck)
		if body := corpoJSON(t, resp); body["payload"] != nil {
			t.Errorf("esperava null, veio %v", body["payload"])
		}
	})
}

func TestPostAlteracaoDraft(t *testing.T) {
	t.Parallel()

	t.Run("payload parcial válido → 200 e persiste com tipo denormalizado", func(t *testing.T) {
		amb := novoAmbiente(t)
		ck := amb.cookieSessaoAlteracaoValida(t, "s1")

		corpo := `{"identificacao":{"cnpj":"12.345.678/0001-90","razaoSocial":"Prolink Servicos Ltda","tipoConstituicao":"ltda","situacao":"ativa","enderecoAtual":{"logradouro":"Avenida Paulista","bairro":"Bela Vista","municipio":"Sao Paulo","estado":"SP","cep":"01310-100"}}}`
		resp := amb.req(t, http.MethodPost, "/api/alteracao/draft", corpo, amb.cookieAceiteValido(t), ck)
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("status = %d", resp.StatusCode)
		}
		if amb.alteracao.tipoGravado != entity.TipoLtda {
			t.Errorf("tipoGravado = %q", amb.alteracao.tipoGravado)
		}
		if len(amb.alteracao.payloadGravado) == 0 {
			t.Error("payload não foi gravado")
		}
	})

	t.Run("chave de topo desconhecida → 400 com corpo do Node", func(t *testing.T) {
		amb := novoAmbiente(t)
		ck := amb.cookieSessaoAlteracaoValida(t, "s1")

		resp := amb.req(t, http.MethodPost, "/api/alteracao/draft", `{"foo":"bar"}`, amb.cookieAceiteValido(t), ck)
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
		if amb.alteracao.payloadGravado != nil {
			t.Error("não deveria ter gravado payload inválido")
		}
	})
}

func TestPostAlteracaoSubmit(t *testing.T) {
	t.Parallel()

	t.Run("payload inválido → 400 com corpo do Node, sem efeito colateral", func(t *testing.T) {
		amb := novoAmbiente(t)
		ck := amb.cookieSessaoAlteracaoValida(t, "s1")

		resp := amb.req(t, http.MethodPost, "/api/alteracao/submit",
			`{"quadros":["objeto_social"]}`, amb.cookieAceiteValido(t), ck)
		if resp.StatusCode != http.StatusBadRequest {
			t.Fatalf("status = %d, esperado 400", resp.StatusCode)
		}
		if corpoJSON(t, resp)["error"] != "Payload inválido" {
			t.Error("corpo divergente do Node")
		}
		if amb.alteracao.enviadoProtocolo != "" {
			t.Error("payload inválido não deveria disparar marcarEnviado")
		}
	})

	t.Run("caminho feliz → 200 {protocolo ALT-} + cookie de sessão expirado", func(t *testing.T) {
		amb := novoAmbiente(t)
		ck := amb.cookieSessaoAlteracaoValida(t, "s1")

		var pubMsg entity.SubmissaoMessage
		amb.protocolo.EXPECT().Proximo(gomock.Any(), entity.ProtocoloPrefixAlteracao).Return("ALT-2026-000007", nil)
		amb.storage.EXPECT().PutJSON(gomock.Any(), "protocolos/ALT-2026-000007/alteracao.json", gomock.Any()).Return(nil)
		amb.publisher.EXPECT().Publish(gomock.Any(), gomock.Any()).DoAndReturn(
			func(_ context.Context, m entity.SubmissaoMessage) error { pubMsg = m; return nil })
		// Sem Copy / DeletePrefix: o teste falha se o serviço tentar (form sem upload).

		resp := amb.req(t, http.MethodPost, "/api/alteracao/submit",
			alteracaoValida(t, "full_valido_q02"), amb.cookieAceiteValido(t), ck)
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("status = %d", resp.StatusCode)
		}
		if corpoJSON(t, resp)["protocolo"] != "ALT-2026-000007" {
			t.Errorf("protocolo divergente")
		}
		if pubMsg.FormType != entity.FormAlteracao || pubMsg.Tipo != entity.TipoLtda || pubMsg.Protocolo != "ALT-2026-000007" {
			t.Errorf("mensagem publicada = %+v", pubMsg)
		}
		if amb.alteracao.enviadoProtocolo != "ALT-2026-000007" {
			t.Errorf("marcarEnviado = %q", amb.alteracao.enviadoProtocolo)
		}
		if c := cookieChamado(resp, auth.CookieSessao); c == nil || c.MaxAge >= 0 {
			t.Errorf("cookie de sessão não foi expirado: %+v", c)
		}
	})
}
