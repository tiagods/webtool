package config_test

import (
	"strings"
	"testing"
	"time"

	"github.com/tiagods/webtool/apps/backend/infrastructure/config"
)

// fullValidEnv devolve um conjunto de variáveis suficiente para um Load bem-sucedido.
func fullValidEnv() map[string]string {
	return map[string]string{
		"APP_ENV":                      "dev",
		"JWT_SECRET":                   "segredo-de-teste",
		"AWS_REGION":                   "us-east-1",
		"AWS_DYNAMODB_TABLE":           "fichas-abertura",
		"AWS_DYNAMODB_ALTERACAO_TABLE": "fichas-alteracao",
		"AWS_DYNAMODB_ACEITES_TABLE":   "prolink-aceites-lgpd",
		"AWS_S3_BUCKET":                "prolink-fichas",
		"AWS_SQS_QUEUE_URL":            "http://sqs.local/queue",
		"SMTP_HOST":                    "smtp.example.com",
		"SMTP_USER":                    "user",
		"SMTP_FROM":                    "noreply@test.com",
		"SMTP_TO":                      "test@test.com",
	}
}

func lookupFrom(env map[string]string) config.Lookup {
	return func(key string) (string, bool) {
		v, ok := env[key]
		return v, ok
	}
}

func TestLoad_ValidoComDefaults(t *testing.T) {
	t.Parallel()

	cfg, err := config.Load(lookupFrom(fullValidEnv()))
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
}

func TestLoad_OverridesAplicados(t *testing.T) {
	t.Parallel()

	env := fullValidEnv()
	env["APP_ENV"] = "prod"
	env["PORT"] = "8080"
	env["SESSION_EXPIRY_SECONDS"] = "60"
	env["SHUTDOWN_TIMEOUT_SECONDS"] = "5"

	cfg, err := config.Load(lookupFrom(env))
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

func TestLoad_ErrosDeValidacao(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		mutate      func(map[string]string)
		wantInError []string
	}{
		{
			name:        "JWT_SECRET ausente",
			mutate:      func(m map[string]string) { delete(m, "JWT_SECRET") },
			wantInError: []string{"JWT_SECRET"},
		},
		{
			name:        "JWT_SECRET vazia",
			mutate:      func(m map[string]string) { m["JWT_SECRET"] = "" },
			wantInError: []string{"JWT_SECRET"},
		},
		{
			name: "multiplas obrigatorias ausentes",
			mutate: func(m map[string]string) {
				delete(m, "JWT_SECRET")
				delete(m, "AWS_REGION")
				delete(m, "AWS_S3_BUCKET")
			},
			wantInError: []string{"JWT_SECRET", "AWS_REGION", "AWS_S3_BUCKET"},
		},
		{
			name:        "APP_ENV ausente",
			mutate:      func(m map[string]string) { delete(m, "APP_ENV") },
			wantInError: []string{"APP_ENV"},
		},
		{
			name:        "APP_ENV invalido",
			mutate:      func(m map[string]string) { m["APP_ENV"] = "staging" },
			wantInError: []string{"APP_ENV", "staging"},
		},
		{
			name:        "PORT nao numerico",
			mutate:      func(m map[string]string) { m["PORT"] = "abc" },
			wantInError: []string{"PORT"},
		},
		{
			name:        "SESSION_EXPIRY_SECONDS nao numerico",
			mutate:      func(m map[string]string) { m["SESSION_EXPIRY_SECONDS"] = "x" },
			wantInError: []string{"SESSION_EXPIRY_SECONDS"},
		},
		{
			name:        "AWS_ENDPOINT_URL sem credenciais",
			mutate:      func(m map[string]string) { m["AWS_ENDPOINT_URL"] = "http://floci:4566" },
			wantInError: []string{"AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			env := fullValidEnv()
			tt.mutate(env)

			_, err := config.Load(lookupFrom(env))
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

func TestLoad_EndpointComCredenciais(t *testing.T) {
	t.Parallel()

	env := fullValidEnv()
	env["AWS_ENDPOINT_URL"] = "http://floci:4566"
	env["AWS_ACCESS_KEY_ID"] = "test"
	env["AWS_SECRET_ACCESS_KEY"] = "test"

	cfg, err := config.Load(lookupFrom(env))
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
