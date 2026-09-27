// Package config carrega e valida toda a configuração do processo a partir de
// variáveis de ambiente. É o único pacote autorizado a ler o ambiente — o resto
// do código recebe uma Config já validada.
package config

import (
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/caarlos0/env/v11"
)

// Env identifica o ambiente de execução. Decide, entre outras coisas, se o
// cookie de sessão recebe a flag Secure.
type Env string

// Valores reconhecidos de Env.
const (
	EnvDev  Env = "dev"
	EnvProd Env = "prod"
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
	From     string // remetente (ex: "noreply@example.com")
	To       string // destinatário interno (ex: "destinatario@example.com")
}

// UsesAuth informa se o servidor SMTP exige autenticação.
func (s SMTP) UsesAuth() bool {
	return s.User != "" || s.Password != ""
}

// Configured informa se um servidor SMTP foi configurado. Em dev, ausente
// implica fallback para arquivo (FileMailer); em produção é sempre obrigatória.
func (s SMTP) Configured() bool {
	return s.Host != ""
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
	EmailOutputDir  string // destino do fallback de e-mail em arquivo (dev sem SMTP)
}

// IsProd informa se o processo roda em ambiente de produção.
func (c Config) IsProd() bool {
	return c.Env == EnvProd
}

// raw espelha as variáveis de ambiente com as tags de github.com/caarlos0/env.
// required+notEmpty reproduzem o comportamento anterior: ausente OU vazio = erro.
type raw struct {
	Port                   int    `env:"PORT" envDefault:"3001"`
	Env                    string `env:"APP_ENV,required,notEmpty"`
	JWTSecret              string `env:"JWT_SECRET,required,notEmpty"`
	SessionExpirySeconds   int    `env:"SESSION_EXPIRY_SECONDS" envDefault:"7200"`
	ShutdownTimeoutSeconds int    `env:"SHUTDOWN_TIMEOUT_SECONDS" envDefault:"10"`

	AWSRegion               string `env:"AWS_REGION,required,notEmpty"`
	AWSEndpointURL          string `env:"AWS_ENDPOINT_URL"`
	AWSAccessKeyID          string `env:"AWS_ACCESS_KEY_ID"`
	AWSSecretAccessKey      string `env:"AWS_SECRET_ACCESS_KEY"`
	AWSDynamoAberturaTable  string `env:"AWS_DYNAMODB_TABLE,required,notEmpty"`
	AWSDynamoAlteracaoTable string `env:"AWS_DYNAMODB_ALTERACAO_TABLE,required,notEmpty"`
	AWSDynamoAceitesTable   string `env:"AWS_DYNAMODB_ACEITES_TABLE,required,notEmpty"`
	AWSS3Bucket             string `env:"AWS_S3_BUCKET,required,notEmpty"`
	AWSSQSQueueURL          string `env:"AWS_SQS_QUEUE_URL,required,notEmpty"`

	// SMTP é opcional em dev (fallback para arquivo); obrigatório em prod.
	SMTPHost       string `env:"SMTP_HOST"`
	SMTPPort       int    `env:"SMTP_PORT" envDefault:"587"`
	SMTPUser       string `env:"SMTP_USER"`
	SMTPPassword   string `env:"SMTP_PASSWORD"`
	SMTPFrom       string `env:"SMTP_FROM"`
	SMTPTo         string `env:"SMTP_TO"`
	EmailOutputDir string `env:"EMAIL_OUTPUT_DIR"`
}

// LoadFromEnv carrega a configuração a partir do ambiente do processo. Em caso
// de erro, retorna um erro agregado (caarlos0/env + validações pós-parse)
// listando todas as variáveis ausentes ou inválidas — nunca uma Config parcial.
func LoadFromEnv() (Config, error) {
	var r raw
	if err := env.Parse(&r); err != nil {
		return Config{}, err
	}
	return r.config()
}

// config valida o que as tags não expressam (enum de APP_ENV e credenciais AWS
// condicionais ao endpoint) e converte o raw para Config.
func (r raw) config() (Config, error) {
	var errs []error

	environment := Env(r.Env)
	if environment != EnvDev && environment != EnvProd {
		errs = append(errs, fmt.Errorf("APP_ENV deve ser um de [dev prod], recebido %q", r.Env))
	}

	if r.AWSEndpointURL != "" {
		if r.AWSAccessKeyID == "" {
			errs = append(errs, errors.New("AWS_ACCESS_KEY_ID é obrigatória quando AWS_ENDPOINT_URL está definida"))
		}
		if r.AWSSecretAccessKey == "" {
			errs = append(errs, errors.New("AWS_SECRET_ACCESS_KEY é obrigatória quando AWS_ENDPOINT_URL está definida"))
		}
	}

	if r.SMTPHost != "" {
		if r.SMTPFrom == "" {
			errs = append(errs, errors.New("SMTP_FROM é obrigatória quando SMTP_HOST está definida"))
		}
		if r.SMTPTo == "" {
			errs = append(errs, errors.New("SMTP_TO é obrigatória quando SMTP_HOST está definida"))
		}
	} else if environment == EnvProd {
		errs = append(errs, errors.New("SMTP_HOST é obrigatória em produção (APP_ENV=prod)"))
	}

	if err := errors.Join(errs...); err != nil {
		return Config{}, err
	}

	emailOutputDir := r.EmailOutputDir
	if emailOutputDir == "" {
		emailOutputDir = os.TempDir()
	}

	return Config{
		Port:            r.Port,
		Env:             environment,
		JWTSecret:       r.JWTSecret,
		SessionExpiry:   time.Duration(r.SessionExpirySeconds) * time.Second,
		ShutdownTimeout: time.Duration(r.ShutdownTimeoutSeconds) * time.Second,
		AWS: AWS{
			Region:               r.AWSRegion,
			EndpointURL:          r.AWSEndpointURL,
			AccessKeyID:          r.AWSAccessKeyID,
			SecretAccessKey:      r.AWSSecretAccessKey,
			DynamoAberturaTable:  r.AWSDynamoAberturaTable,
			DynamoAlteracaoTable: r.AWSDynamoAlteracaoTable,
			DynamoAceitesTable:   r.AWSDynamoAceitesTable,
			S3Bucket:             r.AWSS3Bucket,
			SQSQueueURL:          r.AWSSQSQueueURL,
		},
		SMTP: SMTP{
			Host:     r.SMTPHost,
			Port:     r.SMTPPort,
			User:     r.SMTPUser,
			Password: r.SMTPPassword,
			From:     r.SMTPFrom,
			To:       r.SMTPTo,
		},
		EmailOutputDir: emailOutputDir,
	}, nil
}
