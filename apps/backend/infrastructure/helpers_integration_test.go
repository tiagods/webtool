//go:build integration

package infrastructure

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	awssdk "github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
	"github.com/aws/aws-sdk-go-v2/service/sqs/types"

	"github.com/tiagods/webtool/apps/backend/domain/entity"
	"github.com/tiagods/webtool/apps/backend/infrastructure/auth"
	testhelpers "github.com/tiagods/webtool/apps/backend/infrastructure/testhelpers"
)

func req(d *testhelpers.TestDeps, t *testing.T, method, path, body string, cookies []*http.Cookie) *http.Response {
	t.Helper()
	var r io.Reader
	if body != "" {
		r = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, r)
	req.Header.Set("Content-Type", "application/json")
	for _, c := range cookies {
		if c != nil {
			req.AddCookie(c)
		}
	}
	rec := httptest.NewRecorder()
	d.Echo.ServeHTTP(rec, req)
	return rec.Result()
}

func assertStatus(t *testing.T, resp *http.Response, want int) {
	t.Helper()
	if resp.StatusCode != want {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		t.Fatalf("status=%d, esperado=%d; body: %s", resp.StatusCode, want, body)
	}
}

func extrairCookie(resp *http.Response, nome string) *http.Cookie {
	for _, c := range resp.Cookies() {
		if c.Name == nome {
			return c
		}
	}
	return nil
}

func criarAceite(d *testhelpers.TestDeps, t *testing.T) *http.Cookie {
	t.Helper()
	resp := req(d, t, http.MethodPost, "/api/aceite-termo",
		`{"versaoTermo":"`+entity.TermoVersaoAtual+`","ip":"127.0.0.1","userAgent":"test"}`, nil)
	assertStatus(t, resp, http.StatusOK)
	c := extrairCookie(resp, auth.CookieAceite)
	if c == nil {
		t.Fatal("cookie aceite não emitido")
	}
	return c
}

func criarSessao(d *testhelpers.TestDeps, t *testing.T, aceite *http.Cookie) *http.Cookie {
	t.Helper()
	resp := req(d, t, http.MethodPost, "/api/session", "", []*http.Cookie{aceite})
	assertStatus(t, resp, http.StatusOK)
	c := extrairCookie(resp, auth.CookieSessao)
	if c == nil {
		t.Fatal("cookie sessão não emitido")
	}
	return c
}

func receberMensagemSQS(d *testhelpers.TestDeps, t *testing.T) *types.Message {
	t.Helper()
	ctx := context.Background()
	out, err := d.Clients.SQS.ReceiveMessage(ctx, &sqs.ReceiveMessageInput{
		QueueUrl: awssdk.String(d.SQSQueueURL), MaxNumberOfMessages: 1, WaitTimeSeconds: 5,
	})
	if err != nil {
		t.Fatalf("ReceiveMessage: %v", err)
	}
	if len(out.Messages) == 0 {
		return nil
	}
	return &out.Messages[0]
}

func deletarMensagemSQS(d *testhelpers.TestDeps, t *testing.T, handle string) {
	t.Helper()
	ctx := context.Background()
	_, err := d.Clients.SQS.DeleteMessage(ctx, &sqs.DeleteMessageInput{
		QueueUrl: awssdk.String(d.SQSQueueURL), ReceiptHandle: awssdk.String(handle),
	})
	if err != nil {
		t.Fatalf("DeleteMessage: %v", err)
	}
}

func seedS3Object(d *testhelpers.TestDeps, t *testing.T, key, ct, content string) {
	t.Helper()
	ctx := context.Background()
	_, err := d.Clients.S3.PutObject(ctx, &s3.PutObjectInput{
		Bucket: awssdk.String(d.S3Bucket), Key: awssdk.String(key),
		Body: strings.NewReader(content), ContentType: awssdk.String(ct),
	})
	if err != nil {
		t.Fatalf("PutObject %s: %v", key, err)
	}
}

// drenarFilaSQS consome e apaga todas as mensagens pendentes da fila SQS.
func drenarFilaSQS(d *testhelpers.TestDeps, t *testing.T) {
	t.Helper()
	for {
		msg := receberMensagemSQS(d, t)
		if msg == nil {
			return
		}
		deletarMensagemSQS(d, t, *msg.ReceiptHandle)
	}
}

func mustDecodeJSON(t *testing.T, resp *http.Response, v any) {
	t.Helper()
	body, err := io.ReadAll(resp.Body)
	resp.Body.Close()
	if err != nil {
		t.Fatalf("ler body: %v", err)
	}
	if err := json.Unmarshal(body, v); err != nil {
		t.Fatalf("JSON: %v (body: %s)", err, body)
	}
}

func casoAbertura(t *testing.T, nome string) string {
	t.Helper()
	type caso struct {
		Nome  string          `json:"nome"`
		Input json.RawMessage `json:"input"`
	}
	casos := readJSON[[]caso](t, "domain/validation/testdata/casos_abertura.json")
	for _, c := range casos {
		if c.Nome == nome {
			return string(c.Input)
		}
	}
	t.Fatalf("caso %q não encontrado", nome)
	return ""
}

func casoAlteracao(t *testing.T, nome string) string {
	t.Helper()
	type caso struct {
		Nome  string          `json:"nome"`
		Input json.RawMessage `json:"input"`
	}
	casos := readJSON[[]caso](t, "domain/validation/testdata/casos_alteracao.json")
	for _, c := range casos {
		if c.Nome == nome {
			return string(c.Input)
		}
	}
	t.Fatalf("caso %q não encontrado", nome)
	return ""
}

func readJSON[T any](t *testing.T, rel string) T {
	t.Helper()
	joined := filepath.Join("..", rel)
	data, err := os.ReadFile(joined)
	if err != nil {
		t.Fatalf("ler %s: %v", joined, err)
	}
	var v T
	if err := json.Unmarshal(data, &v); err != nil {
		t.Fatalf("decodificar %s: %v", joined, err)
	}
	return v
}