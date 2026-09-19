package config_test

import (
	"os"
	"strings"
	"testing"
	"time"

	"github.com/tiagods/webtool/apps/backend/infrastructure/config"
)

// baseEnv aplica um ambiente mínimo válido. Variáveis opcionais/default são
// limpas para não vazar do ambiente real da máquina.
func baseEnv(t *testing.T) {
	t.Helper()

	for k, v := range map[string]string{
		"APP_ENV":                      "dev",
		"JWT_SECRET":                   "segredo-de-teste",
		"AWS_REGION":                   "us-east-1",
		"AWS_DYNAMODB_TABLE":           "fichas-abertura",
		"AWS_DYNAMODB_ALTERACAO_TABLE": "fichas-alteracao",
		"AWS_DYNAMODB_ACEITES_TABLE":   "prolink-aceites-lgpd",
		"AWS_S3_BUCKET":                "prolink-fichas",
		"AWS_SQS_QUEUE_URL":            "http://sqs.local/queue",
		"SMTP_HOST":                    "smtp.example.com",
		"SMTP_PORT":                    "587",
		"SMTP_USER":                    "user",
		"SMTP_PASSWORD":                "senha",
		"SMTP_FROM":                    "noreply@example.com",
		"SMTP_TO":                      "destinatario@example.com",
	} {
		t.Setenv(k, v)
	}

	unset(t, "AWS_ENDPOINT_URL", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY",
		"PORT", "SESSION_EXPIRY_SECONDS", "SHUTDOWN_TIMEOUT_SECONDS")
}

// unset remove as variáveis durante o teste e restaura o estado anterior no fim.
func unset(t *testing.T, keys ...string) {
	t.Helper()
	for _, key := range keys {
		old, existed := os.LookupEnv(key)
		_ = os.Unsetenv(key)
		if existed {
			t.Cleanup(func() { _ = os.Setenv(key, old) })
		} else {
			t.Cleanup(func() { _ = os.Unsetenv(key) })
		}
	}
}

func TestLoadFromEnv_ValidoComDefaults(t *testing.T) {
	baseEnv(t)

	cfg, err := config.LoadFromEnv()
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}

	if cfg.Port != 3001 {
		t.Errorf("Port = %d, esperado 3001", cfg.Port)
	}
	if cfg.Env != config.EnvDev || cfg.IsProd() {
		t.Errorf("Env = %q, IsProd() = %v", cfg.Env, cfg.IsProd())
	}
	if cfg.SessionExpiry != 7200*time.Second {
		t.Errorf("SessionExpiry = %s, esperado 2h", cfg.SessionExpiry)
	}
	if cfg.ShutdownTimeout != 10*time.Second {
		t.Errorf("ShutdownTimeout = %s, esperado 10s", cfg.ShutdownTimeout)
	}
	if cfg.AWS.UsesCustomEndpoint() {
		t.Errorf("UsesCustomEndpoint() = true, esperado false sem AWS_ENDPOINT_URL")
	}
	if cfg.SMTP.Port != 587 {
		t.Errorf("SMTP.Port = %d, esperado 587", cfg.SMTP.Port)
	}
	if !cfg.SMTP.UsesAuth() {
		t.Errorf("UsesAuth() = false, esperado true com SMTP_USER/PASSWORD")
	}
}

func TestLoadFromEnv_OverridesAplicados(t *testing.T) {
	baseEnv(t)
	t.Setenv("APP_ENV", "prod")
	t.Setenv("PORT", "8080")
	t.Setenv("SESSION_EXPIRY_SECONDS", "60")
	t.Setenv("SHUTDOWN_TIMEOUT_SECONDS", "5")

	cfg, err := config.LoadFromEnv()
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}

	if !cfg.IsProd() {
		t.Errorf("IsProd() = false, esperado true para APP_ENV=prod")
	}
	if cfg.Port != 8080 {
		t.Errorf("Port = %d, esperado 8080", cfg.Port)
	}
	if cfg.SessionExpiry != 60*time.Second {
		t.Errorf("SessionExpiry = %s, esperado 60s", cfg.SessionExpiry)
	}
	if cfg.ShutdownTimeout != 5*time.Second {
		t.Errorf("ShutdownTimeout = %s, esperado 5s", cfg.ShutdownTimeout)
	}
}

func TestLoadFromEnv_ErrosDeValidacao(t *testing.T) {
	tests := []struct {
		name        string
		mutate      func(t *testing.T)
		wantInError []string
	}{
		{
			name:        "JWT_SECRET ausente",
			mutate:      func(t *testing.T) { unset(t, "JWT_SECRET") },
			wantInError: []string{"JWT_SECRET"},
		},
		{
			name:        "JWT_SECRET vazia",
			mutate:      func(t *testing.T) { t.Setenv("JWT_SECRET", "") },
			wantInError: []string{"JWT_SECRET"},
		},
		{
			name: "multiplas obrigatorias ausentes",
			mutate: func(t *testing.T) {
				unset(t, "JWT_SECRET", "AWS_REGION", "AWS_S3_BUCKET")
			},
			wantInError: []string{"JWT_SECRET", "AWS_REGION", "AWS_S3_BUCKET"},
		},
		{
			name:        "APP_ENV ausente",
			mutate:      func(t *testing.T) { unset(t, "APP_ENV") },
			wantInError: []string{"APP_ENV"},
		},
		{
			name:        "APP_ENV invalido",
			mutate:      func(t *testing.T) { t.Setenv("APP_ENV", "staging") },
			wantInError: []string{"APP_ENV", "staging"},
		},
		{
			name:        "PORT nao numerico",
			mutate:      func(t *testing.T) { t.Setenv("PORT", "abc") },
			wantInError: []string{"Port"},
		},
		{
			name:        "SESSION_EXPIRY_SECONDS nao numerico",
			mutate:      func(t *testing.T) { t.Setenv("SESSION_EXPIRY_SECONDS", "x") },
			wantInError: []string{"SessionExpirySeconds"},
		},
		{
			name:        "SMTP_PORT ausente",
			mutate:      func(t *testing.T) { unset(t, "SMTP_PORT") },
			wantInError: []string{"SMTP_PORT"},
		},
		{
			name:        "AWS_ENDPOINT_URL sem credenciais",
			mutate:      func(t *testing.T) { t.Setenv("AWS_ENDPOINT_URL", "http://floci:4566") },
			wantInError: []string{"AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			baseEnv(t)
			tt.mutate(t)

			_, err := config.LoadFromEnv()
			if err == nil {
				t.Fatalf("esperava erro, obteve nil")
			}
			for _, want := range tt.wantInError {
				if !strings.Contains(err.Error(), want) {
					t.Errorf("erro %q não menciona %q", err.Error(), want)
				}
			}
		})
	}
}

func TestLoadFromEnv_EndpointComCredenciais(t *testing.T) {
	baseEnv(t)
	t.Setenv("AWS_ENDPOINT_URL", "http://floci:4566")
	t.Setenv("AWS_ACCESS_KEY_ID", "test")
	t.Setenv("AWS_SECRET_ACCESS_KEY", "test")

	cfg, err := config.LoadFromEnv()
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if !cfg.AWS.UsesCustomEndpoint() {
		t.Errorf("UsesCustomEndpoint() = false, esperado true")
	}
	if cfg.AWS.AccessKeyID != "test" || cfg.AWS.SecretAccessKey != "test" {
		t.Errorf("credenciais = %q/%q, esperado test/test", cfg.AWS.AccessKeyID, cfg.AWS.SecretAccessKey)
	}
}
