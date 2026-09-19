package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const segredoTeste = "segredo-de-teste-nao-usar-em-prod"

func TestJWTTokenService_RoundTrip(t *testing.T) {
	t.Parallel()
	svc := NewJWTTokenService(segredoTeste, 2*time.Hour)

	t.Run("aceite", func(t *testing.T) {
		t.Parallel()
		token, err := svc.AssinarAceite("sess-1", "v1.0")
		if err != nil {
			t.Fatalf("assinar: %v", err)
		}
		versao, err := svc.VerificarAceite(token)
		if err != nil {
			t.Fatalf("verificar: %v", err)
		}
		if versao != "v1.0" {
			t.Errorf("versaoTermo = %q", versao)
		}
	})

	t.Run("sessão", func(t *testing.T) {
		t.Parallel()
		token, err := svc.AssinarSessao("sess-2")
		if err != nil {
			t.Fatalf("assinar: %v", err)
		}
		id, err := svc.VerificarSessao(token)
		if err != nil {
			t.Fatalf("verificar: %v", err)
		}
		if id != "sess-2" {
			t.Errorf("sub = %q", id)
		}
	})
}

func TestJWTTokenService_RejeitaTokenInvalido(t *testing.T) {
	t.Parallel()
	svc := NewJWTTokenService(segredoTeste, 2*time.Hour)

	t.Run("segredo diferente", func(t *testing.T) {
		t.Parallel()
		outro := NewJWTTokenService("outro-segredo", 2*time.Hour)
		token, _ := outro.AssinarSessao("x")
		if _, err := svc.VerificarSessao(token); err == nil {
			t.Fatal("esperava erro para token assinado com outro segredo")
		}
	})

	t.Run("algoritmo none", func(t *testing.T) {
		t.Parallel()
		raw := jwt.NewWithClaims(jwt.SigningMethodNone, jwt.RegisteredClaims{Subject: "x"})
		token, err := raw.SignedString(jwt.UnsafeAllowNoneSignatureType)
		if err != nil {
			t.Fatalf("montar token none: %v", err)
		}
		if _, err := svc.VerificarSessao(token); err == nil {
			t.Fatal("esperava rejeição de alg=none")
		}
	})

	t.Run("expirado", func(t *testing.T) {
		t.Parallel()
		passado := NewJWTTokenService(segredoTeste, 2*time.Hour)
		passado.now = func() time.Time { return time.Now().Add(-3 * time.Hour) }
		token, _ := passado.AssinarSessao("x")
		if _, err := svc.VerificarSessao(token); err == nil {
			t.Fatal("esperava rejeição de token expirado")
		}
	})
}

// TestJWTTokenService_FormatoCompativelJose confere as invariantes que o
// verificador do front depende: header HS256 e claims iat/exp numéricas.
func TestJWTTokenService_FormatoCompativelJose(t *testing.T) {
	t.Parallel()
	svc := NewJWTTokenService(segredoTeste, 2*time.Hour)
	token, err := svc.AssinarAceite("sess-1", "v1.0")
	if err != nil {
		t.Fatalf("assinar: %v", err)
	}

	parsed, _, err := jwt.NewParser().ParseUnverified(token, jwt.MapClaims{})
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if parsed.Method.Alg() != "HS256" {
		t.Errorf("alg = %q, esperado HS256", parsed.Method.Alg())
	}
	claims := parsed.Claims.(jwt.MapClaims)
	for _, c := range []string{"iat", "exp"} {
		if _, ok := claims[c].(float64); !ok {
			t.Errorf("claim %s não é numérica: %T", c, claims[c])
		}
	}
	if claims["versaoTermo"] != "v1.0" {
		t.Errorf("versaoTermo = %v", claims["versaoTermo"])
	}
}
