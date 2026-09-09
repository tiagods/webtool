package web_test

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"go.uber.org/mock/gomock"

	"github.com/tiagods/webtool/apps/api/domain/entity"
	"github.com/tiagods/webtool/apps/api/domain/service"
)

const draftParcialValido = `{"dadosEmpresa":{"tipoConstituicao":"ltda","nomeEmpresarial1":"Aaa Bbb","nomeEmpresarial2":"Ccc Ddd","nomeEmpresarial3":"Eee Fff","atividade":"Consultoria empresarial diversa e ampla"}}`

func corpoJSON(t *testing.T, resp *http.Response) map[string]any {
	t.Helper()
	var m map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&m); err != nil {
		t.Fatalf("decodificar corpo: %v", err)
	}
	return m
}

func TestGetDraft(t *testing.T) {
	t.Parallel()

	t.Run("sem cookie de aceite → 403", func(t *testing.T) {
		amb := novoAmbiente(t)
		resp := amb.req(t, http.MethodGet, "/api/draft", "")
		if resp.StatusCode != http.StatusForbidden {
			t.Fatalf("status = %d, esperado 403", resp.StatusCode)
		}
	})

	t.Run("com aceite mas sem sessão válida → 403", func(t *testing.T) {
		amb := novoAmbiente(t)
		resp := amb.req(t, http.MethodGet, "/api/draft", "", amb.cookieAceiteValido(t))
		if resp.StatusCode != http.StatusForbidden {
			t.Fatalf("status = %d, esperado 403", resp.StatusCode)
		}
	})

	t.Run("com aceite + sessão → 200 com payload e documentosKeys salvos", func(t *testing.T) {
		amb := novoAmbiente(t)
		ck := amb.cookieSessaoValida(t, "s1")
		amb.abertura.itens["s1"].Payload = json.RawMessage(`{"senhaGovBr":"x"}`)
		amb.abertura.itens["s1"].DocumentosKeys = map[string]string{"rg": "s1/documentos/rg.pdf"}

		resp := amb.req(t, http.MethodGet, "/api/draft", "", amb.cookieAceiteValido(t), ck)
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("status = %d", resp.StatusCode)
		}
		body := corpoJSON(t, resp)
		if body["payload"].(map[string]any)["senhaGovBr"] != "x" {
			t.Errorf("payload = %v", body["payload"])
		}
		if body["documentosKeys"].(map[string]any)["rg"] != "s1/documentos/rg.pdf" {
			t.Errorf("documentosKeys = %v", body["documentosKeys"])
		}
	})

	t.Run("rascunho recém-criado → 200 com payload/documentosKeys null", func(t *testing.T) {
		amb := novoAmbiente(t)
		ck := amb.cookieSessaoValida(t, "s2")

		resp := amb.req(t, http.MethodGet, "/api/draft", "", amb.cookieAceiteValido(t), ck)
		body := corpoJSON(t, resp)
		if body["payload"] != nil || body["documentosKeys"] != nil {
			t.Errorf("esperava null/null, veio %v / %v", body["payload"], body["documentosKeys"])
		}
	})
}

func TestPostDraft(t *testing.T) {
	t.Parallel()

	t.Run("sem sessão → 403", func(t *testing.T) {
		amb := novoAmbiente(t)
		resp := amb.req(t, http.MethodPost, "/api/draft", "{}", amb.cookieAceiteValido(t))
		if resp.StatusCode != http.StatusForbidden {
			t.Fatalf("status = %d, esperado 403", resp.StatusCode)
		}
	})

	t.Run("payload parcial válido → 200 e persiste com tipo denormalizado", func(t *testing.T) {
		amb := novoAmbiente(t)
		ck := amb.cookieSessaoValida(t, "s1")

		resp := amb.req(t, http.MethodPost, "/api/draft", draftParcialValido, amb.cookieAceiteValido(t), ck)
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("status = %d", resp.StatusCode)
		}
		if amb.abertura.tipoGravado != entity.TipoLtda {
			t.Errorf("tipoGravado = %q", amb.abertura.tipoGravado)
		}
		if len(amb.abertura.payloadGravado) == 0 {
			t.Error("payload não foi gravado")
		}
	})

	t.Run("chave de topo desconhecida → 400 com corpo do Node", func(t *testing.T) {
		amb := novoAmbiente(t)
		ck := amb.cookieSessaoValida(t, "s1")

		resp := amb.req(t, http.MethodPost, "/api/draft", `{"foo":"bar"}`, amb.cookieAceiteValido(t), ck)
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
		if amb.abertura.payloadGravado != nil {
			t.Error("não deveria ter gravado payload inválido")
		}
	})

	t.Run("variante uploadedCampo → 200 e grava a key", func(t *testing.T) {
		amb := novoAmbiente(t)
		ck := amb.cookieSessaoValida(t, "s1")

		resp := amb.req(t, http.MethodPost, "/api/draft",
			`{"uploadedCampo":"contrato_social","contentType":"application/pdf"}`,
			amb.cookieAceiteValido(t), ck)
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("status = %d", resp.StatusCode)
		}
		if got := amb.abertura.docsGravados["contrato_social"]; got != "s1/documentos/contrato_social.pdf" {
			t.Errorf("key gravada = %q", got)
		}
	})

	t.Run("variante uploadedCampo com content-type inválido → 400", func(t *testing.T) {
		amb := novoAmbiente(t)
		ck := amb.cookieSessaoValida(t, "s1")

		resp := amb.req(t, http.MethodPost, "/api/draft",
			`{"uploadedCampo":"rg","contentType":"image/gif"}`,
			amb.cookieAceiteValido(t), ck)
		if resp.StatusCode != http.StatusBadRequest {
			t.Fatalf("status = %d, esperado 400", resp.StatusCode)
		}
		if corpoJSON(t, resp)["error"] != "contentType deve ser application/pdf, image/jpeg ou image/png" {
			t.Error("mensagem de erro divergente do Node")
		}
	})

	t.Run("variante uploadedCampo com campo inválido → 400 campo inválido", func(t *testing.T) {
		amb := novoAmbiente(t)
		ck := amb.cookieSessaoValida(t, "s1")

		resp := amb.req(t, http.MethodPost, "/api/draft",
			`{"uploadedCampo":"RG Frente","contentType":"application/pdf"}`,
			amb.cookieAceiteValido(t), ck)
		if resp.StatusCode != http.StatusBadRequest {
			t.Fatalf("status = %d, esperado 400", resp.StatusCode)
		}
		if corpoJSON(t, resp)["error"] != "campo inválido" {
			t.Error("mensagem de erro divergente do Node")
		}
	})
}

func TestPostUploadURL(t *testing.T) {
	t.Parallel()

	t.Run("sem cookie de aceite → 403", func(t *testing.T) {
		amb := novoAmbiente(t)
		resp := amb.req(t, http.MethodPost, "/api/upload-url", `{"campo":"rg","contentType":"application/pdf"}`)
		if resp.StatusCode != http.StatusForbidden {
			t.Fatalf("status = %d, esperado 403", resp.StatusCode)
		}
	})

	t.Run("com aceite, sessão nova → 200 + Set-Cookie + URL assinada", func(t *testing.T) {
		amb := novoAmbiente(t)
		amb.storage.EXPECT().PresignedUploadURL(
			gomock.Any(),
			gomock.Cond(func(key string) bool { return strings.HasSuffix(key, "/documentos/rg.pdf") }),
			"application/pdf",
			service.PresignUploadExpiraEm,
		).Return("https://s3.local/sess/documentos/rg.pdf", nil)

		resp := amb.req(t, http.MethodPost, "/api/upload-url",
			`{"campo":"rg","contentType":"application/pdf"}`, amb.cookieAceiteValido(t))
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("status = %d", resp.StatusCode)
		}
		if cookieChamado(resp, "prolink_session") == nil {
			t.Fatal("cookie de sessão não emitido para sessão nova")
		}
		if url, _ := corpoJSON(t, resp)["url"].(string); url != "https://s3.local/sess/documentos/rg.pdf" {
			t.Errorf("url inesperada: %q", url)
		}
	})

	t.Run("campo inválido → 400 e nenhuma sessão criada", func(t *testing.T) {
		amb := novoAmbiente(t)
		resp := amb.req(t, http.MethodPost, "/api/upload-url",
			`{"campo":"RG","contentType":"application/pdf"}`, amb.cookieAceiteValido(t))
		if resp.StatusCode != http.StatusBadRequest {
			t.Fatalf("status = %d, esperado 400", resp.StatusCode)
		}
		if corpoJSON(t, resp)["error"] != "campo inválido" {
			t.Error("mensagem divergente do Node")
		}
		if len(amb.abertura.itens) != 0 {
			t.Errorf("pedido malformado deixou item órfão: %d itens", len(amb.abertura.itens))
		}
	})

	t.Run("content-type inválido → 400", func(t *testing.T) {
		amb := novoAmbiente(t)
		resp := amb.req(t, http.MethodPost, "/api/upload-url",
			`{"campo":"rg","contentType":"text/plain"}`, amb.cookieAceiteValido(t))
		if resp.StatusCode != http.StatusBadRequest {
			t.Fatalf("status = %d, esperado 400", resp.StatusCode)
		}
	})
}
