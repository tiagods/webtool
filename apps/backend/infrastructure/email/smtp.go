// Package email implementa outbound.EmailSender via SMTP com conteúdo HTML.
// Os documentos do S3 são enviados como presigned URLs no corpo do e-mail
// (não como anexos MIME), evitando o limite de ~25MB do SMTP.
package email

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/smtp"
	"strings"
	"time"

	"github.com/tiagods/webtool/apps/backend/domain/ports/outbound"
	"github.com/tiagods/webtool/apps/backend/infrastructure/config"
)

// SMTPMailer implementa outbound.EmailSender enviando e-mail como HTML via SMTP.
type SMTPMailer struct {
	cfg config.SMTP
}

var _ outbound.EmailSender = (*SMTPMailer)(nil)

// NewSMTPMailer cria um remetente conectado ao servidor SMTP configurado.
func NewSMTPMailer(cfg config.SMTP) *SMTPMailer {
	return &SMTPMailer{cfg: cfg}
}

// Send envia o e-mail HTML com os links presigned dos documentos embutidos
// no corpo. O assunto é prefixado com "[WebTool]" para identificação em
// caixa de entrada.
func (m *SMTPMailer) Send(ctx context.Context, data outbound.EmailData) error {
	header := make(map[string]string)
	header["From"] = m.cfg.From
	header["To"] = data.To
	header["Subject"] = "[WebTool] " + data.Subject
	header["MIME-Version"] = "1.0"
	header["Content-Type"] = "text/html; charset=\"UTF-8\""
	header["Date"] = time.Now().UTC().Format(time.RFC1123Z)

	var buf strings.Builder
	for k, v := range header {
		buf.WriteString(fmt.Sprintf("%s: %s\r\n", k, v))
	}
	buf.WriteString("\r\n")
	buf.WriteString(data.BodyHTML)

	return sendMail(m.cfg, buf.String())
}

// sendMail conecta ao servidor SMTP e envia a mensagem.
func sendMail(cfg config.SMTP, msg string) error {
	addr := net.JoinHostPort(cfg.Host, fmt.Sprintf("%d", cfg.Port))

	// Autenticação PLAIN/LOGIN se houver credenciais
	var auth smtp.Auth
	if cfg.UsesAuth() {
		auth = smtp.PlainAuth("", cfg.User, cfg.Password, cfg.Host)
	}

	// Conexão segura na porta 465 (SSL/TLS direto) ou STARTTLS na 587/25
	if cfg.Port == 465 {
		return sendMailTLS(addr, auth, cfg.From, splitTo(cfg.To), msg)
	}

	client, err := smtp.Dial(addr)
	if err != nil {
		return fmt.Errorf("conectar ao servidor SMTP: %w", err)
	}
	defer client.Close()

	// STARTTLS se disponível
	if ok, _ := client.Extension("STARTTLS"); ok {
		tlsCfg := &tls.Config{ServerName: cfg.Host}
		if err := client.StartTLS(tlsCfg); err != nil {
			return fmt.Errorf("STARTTLS: %w", err)
		}
	}

	if auth != nil {
		if err := client.Auth(auth); err != nil {
			return fmt.Errorf("autenticar SMTP: %w", err)
		}
	}

	if err := client.Mail(cfg.From); err != nil {
		return fmt.Errorf("MAIL FROM: %w", err)
	}

	recipients := splitTo(cfg.To)
	for _, to := range recipients {
		if err := client.Rcpt(to); err != nil {
			return fmt.Errorf("RCPT TO %q: %w", to, err)
		}
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("abrir corpo do e-mail: %w", err)
	}
	if _, err := w.Write([]byte(msg)); err != nil {
		return fmt.Errorf("escrever corpo do e-mail: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("finalizar corpo do e-mail: %w", err)
	}

	return client.Quit()
}

// sendMailTLS conecta via TLS direto (porta 465).
func sendMailTLS(addr string, auth smtp.Auth, from string, to []string, msg string) error {
	tlsCfg := &tls.Config{ServerName: addr}

	conn, err := tls.Dial("tcp", addr, tlsCfg)
	if err != nil {
		return fmt.Errorf("conexão TLS: %w", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, addr)
	if err != nil {
		return fmt.Errorf("cliente SMTP: %w", err)
	}
	defer client.Close()

	if auth != nil {
		if err := client.Auth(auth); err != nil {
			return fmt.Errorf("autenticar SMTP: %w", err)
		}
	}

	if err := client.Mail(from); err != nil {
		return fmt.Errorf("MAIL FROM: %w", err)
	}
	for _, r := range to {
		if err := client.Rcpt(r); err != nil {
			return fmt.Errorf("RCPT TO %q: %w", r, err)
		}
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("abrir corpo: %w", err)
	}
	if _, err := w.Write([]byte(msg)); err != nil {
		return fmt.Errorf("escrever corpo: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("finalizar corpo: %w", err)
	}

	return client.Quit()
}

// splitTo separa destinatários por vírgula (aceita string única ou CSV).
func splitTo(to string) []string {
	parts := strings.Split(to, ",")
	for i := range parts {
		parts[i] = strings.TrimSpace(parts[i])
	}
	return parts
}