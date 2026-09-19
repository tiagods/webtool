package auth

import (
	"encoding/json"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// TestJWT_CompatibilidadeComJose assina tokens em Go e os valida com o
// verificador do front, garantindo que o cookie prolink_aceite emitido pela API
// Go é aceito pelo frontend.
//
// Pula se `node` não estiver disponível (ex.: CI sem toolchain JS).
func TestJWT_CompatibilidadeComJose(t *testing.T) {
	t.Parallel()

	node, err := exec.LookPath("node")
	if err != nil {
		t.Skip("node indisponível — pulando verificação cruzada com jose")
	}

	const segredo = "segredo-compartilhado-go-e-node"
	script, err := filepath.Abs(filepath.Join("..", "..", "..", "..", "scripts", "verify-jwt-cross.mjs"))
	if err != nil {
		t.Fatalf("resolver caminho do script: %v", err)
	}

	svc := NewJWTTokenService(segredo, 2*time.Hour)

	verificaComJose := func(t *testing.T, token string) map[string]any {
		t.Helper()
		cmd := exec.Command(node, script, token)
		cmd.Env = append(cmd.Environ(), "JWT_SECRET="+segredo)
		saida, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("jose rejeitou um token válido: %v\n%s", err, saida)
		}
		var resultado struct {
			Header  map[string]any `json:"header"`
			Payload map[string]any `json:"payload"`
		}
		if err := json.Unmarshal([]byte(firstLine(string(saida))), &resultado); err != nil {
			t.Fatalf("saída inesperada do script: %v\n%s", err, saida)
		}
		if resultado.Header["alg"] != "HS256" {
			t.Errorf("header.alg = %v", resultado.Header["alg"])
		}
		return resultado.Payload
	}

	t.Run("token de aceite", func(t *testing.T) {
		t.Parallel()
		token, err := svc.AssinarAceite("sess-123", "v1.0")
		if err != nil {
			t.Fatalf("assinar: %v", err)
		}
		payload := verificaComJose(t, token)
		if payload["sub"] != "sess-123" || payload["versaoTermo"] != "v1.0" {
			t.Errorf("claims inesperadas: %v", payload)
		}
	})

	t.Run("token de sessão", func(t *testing.T) {
		t.Parallel()
		token, err := svc.AssinarSessao("sess-456")
		if err != nil {
			t.Fatalf("assinar: %v", err)
		}
		payload := verificaComJose(t, token)
		if payload["sub"] != "sess-456" {
			t.Errorf("sub = %v", payload["sub"])
		}
	})

	t.Run("segredo divergente é rejeitado pelo jose", func(t *testing.T) {
		t.Parallel()
		outro := NewJWTTokenService("outro-segredo", 2*time.Hour)
		token, _ := outro.AssinarSessao("x")
		cmd := exec.Command(node, script, token)
		cmd.Env = append(cmd.Environ(), "JWT_SECRET="+segredo)
		if err := cmd.Run(); err == nil {
			t.Fatal("jose deveria ter rejeitado o token com segredo divergente")
		}
	})
}

func firstLine(s string) string {
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		return s[:i]
	}
	return s
}
