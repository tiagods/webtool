// Package config carrega e valida toda a configuração do processo a partir de
// variáveis de ambiente. É o único pacote autorizado a ler o ambiente
// (os.LookupEnv) — o resto do código recebe uma Config já validada.
package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"time"
)

// Env identifica o ambiente de execução. Decide, entre outras coisas, se o
// cookie de sessão recebe a flag Secure.
type Env string

// Valores reconhecidos de Env.
const (
	EnvDev  Env = "dev"
	EnvProd Env = "prod"
)

const (
	defaultPort            = 3001
	defaultSessionExpiry   = 7200 * time.Second
	defaultShutdownTimeout = 10 * time.Second
)

// AWS agrupa as configurações de acesso aos serviços AWS. Fica numa struct
// própria para manter a contagem de campos de Config baixa e o wiring explícito.
type AWS struct {
	Region               string
	EndpointURL          string // "" => cadeia de credenciais/endpoint padrão do SDK (prod)
	AccessKeyID          string
	SecretAccessKey      string
	DynamoAberturaTable  string
	DynamoAlteracaoTable string
	DynamoAceitesTable   string
	S3Bucket             string
	SQSQueueURL          string
}

// UsesCustomEndpoint indica que um endpoint AWS alternativo foi configurado
// (tipicamente o emulador local Floci), o que também exige credenciais estáticas.
func (a AWS) UsesCustomEndpoint() bool {
	return a.EndpointURL != ""
}

// SMTP agrupa as configurações de envio de e-mail via servidor SMTP.
type SMTP struct {
	Host     string
	Port     int
	User     string
	Password string
	From     string // remetente (ex: "noreply@prolinkcontabil.com.br")
	To       string // destinatário interno (ex: "tiagoice@hotmail.com")
}

// UsesAuth informa se o servidor SMTP exige autenticação.
func (s SMTP) UsesAuth() bool {
	return s.User != "" || s.Password != ""
}

// Config é a configuração completa e validada do processo.
type Config struct {
	Port            int
	Env             Env
	JWTSecret       string
	SessionExpiry   time.Duration
	ShutdownTimeout time.Duration
	AWS             AWS
	SMTP            SMTP
}

// IsProd informa se o processo roda em ambiente de produção.
func (c Config) IsProd() bool {
	return c.Env == EnvProd
}

// Lookup tem a mesma assinatura de os.LookupEnv e é o ponto de injeção que
// torna Load testável sem depender do ambiente real.
type Lookup func(key string) (value string, ok bool)

// LoadFromEnv carrega a configuração a partir do ambiente do processo.
func LoadFromEnv() (Config, error) {
	return Load(os.LookupEnv)
}

// Load lê e valida toda a configuração usando lookup como fonte. Em caso de
// erro, retorna um erro agregado (errors.Join) listando todas as variáveis
// ausentes ou inválidas — nunca uma Config parcial.
func Load(lookup Lookup) (Config, error) {
	r := &reader{lookup: lookup}

	cfg := Config{
		Port:            r.intOr("PORT", defaultPort),
		Env:             Env(r.enum("APP_ENV", string(EnvDev), string(EnvProd))),
		JWTSecret:       r.required("JWT_SECRET"),
		SessionExpiry:   r.secondsOr("SESSION_EXPIRY_SECONDS", defaultSessionExpiry),
		ShutdownTimeout: r.secondsOr("SHUTDOWN_TIMEOUT_SECONDS", defaultShutdownTimeout),
		AWS:             loadAWS(r),
		SMTP:            loadSMTP(r),
	}

	if err := r.err(); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

// loadAWS lê o subconjunto AWS da configuração. AWS_ACCESS_KEY_ID e
// AWS_SECRET_ACCESS_KEY só são obrigatórias quando AWS_ENDPOINT_URL está
// definida (uso com o emulador local).
func loadAWS(r *reader) AWS {
	endpoint := r.optional("AWS_ENDPOINT_URL", "")

	credential := func(key string) string { return r.optional(key, "") }
	if endpoint != "" {
		credential = r.required
	}

	return AWS{
		Region:               r.required("AWS_REGION"),
		EndpointURL:          endpoint,
		AccessKeyID:          credential("AWS_ACCESS_KEY_ID"),
		SecretAccessKey:      credential("AWS_SECRET_ACCESS_KEY"),
		DynamoAberturaTable:  r.required("AWS_DYNAMODB_TABLE"),
		DynamoAlteracaoTable: r.required("AWS_DYNAMODB_ALTERACAO_TABLE"),
		DynamoAceitesTable:   r.required("AWS_DYNAMODB_ACEITES_TABLE"),
		S3Bucket:             r.required("AWS_S3_BUCKET"),
		SQSQueueURL:          r.required("AWS_SQS_QUEUE_URL"),
	}
}

// loadSMTP lê o subconjunto SMTP da configuração. SMTP_PASSWORD é opcional
// (servidores sem autenticação), os demais são obrigatórios.
func loadSMTP(r *reader) SMTP {
	return SMTP{
		Host:     r.required("SMTP_HOST"),
		Port:     r.intOr("SMTP_PORT", 587),
		User:     r.required("SMTP_USER"),
		Password: r.optional("SMTP_PASSWORD", ""),
		From:     r.required("SMTP_FROM"),
		To:       r.required("SMTP_TO"),
	}
}

// reader acumula erros de leitura para que Load possa reportar todos de uma vez.
type reader struct {
	lookup Lookup
	errs   []error
}

func (r *reader) required(key string) string {
	value, ok := r.lookup(key)
	if !ok || value == "" {
		r.errs = append(r.errs, fmt.Errorf("%s é obrigatória", key))
		return ""
	}
	return value
}

// optional tem a mesma assinatura de required para poder ser usada de forma
// intercambiável (ver loadAWS). O parâmetro def é o valor quando a variável
// está ausente ou vazia.
func (r *reader) optional(key, def string) string {
	if value, ok := r.lookup(key); ok && value != "" {
		return value
	}
	return def
}

func (r *reader) intOr(key string, def int) int {
	raw, ok := r.lookup(key)
	if !ok || raw == "" {
		return def
	}
	n, err := strconv.Atoi(raw)
	if err != nil {
		r.errs = append(r.errs, fmt.Errorf("%s deve ser um inteiro: %q", key, raw))
		return def
	}
	return n
}

func (r *reader) secondsOr(key string, def time.Duration) time.Duration {
	seconds := r.intOr(key, int(def.Seconds()))
	return time.Duration(seconds) * time.Second
}

func (r *reader) enum(key string, allowed ...string) string {
	value := r.required(key)
	if value == "" {
		return ""
	}
	for _, a := range allowed {
		if value == a {
			return value
		}
	}
	r.errs = append(r.errs, fmt.Errorf("%s deve ser um de %v, recebido %q", key, allowed, value))
	return ""
}

func (r *reader) err() error {
	return errors.Join(r.errs...)
}
