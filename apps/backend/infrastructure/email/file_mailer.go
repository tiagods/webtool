package email

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/tiagods/webtool/apps/backend/domain/ports/outbound"
)

// FileMailer implementa outbound.NotificacaoSender gravando a notificação como
// arquivo HTML em disco. É o fallback de dev sem SMTP: permite inspecionar a
// notificação no navegador sem servidor de e-mail.
type FileMailer struct {
	dir      string
	renderer *Renderer
}

var _ outbound.NotificacaoSender = (*FileMailer)(nil)

// NewFileMailer cria um remetente que grava os e-mails em dir (criada se não
// existir).
func NewFileMailer(dir string, r *Renderer) *FileMailer {
	return &FileMailer{dir: dir, renderer: r}
}

// EnviarAbertura grava o mesmo HTML que o e-mail SMTP levaria (links presigned
// incluídos) em <dir>/<YYYYMMDDTHHMMSSZ>_<slug>.html.
func (m *FileMailer) EnviarAbertura(_ context.Context, n outbound.NotificacaoAbertura) error {
	body, err := m.renderer.RenderAbertura(projetarAbertura(n))
	if err != nil {
		return err
	}
	return m.gravar("Nova abertura — "+n.Protocolo, body, n.Protocolo)
}

// EnviarAlteracao grava a notificação de alteração em disco.
func (m *FileMailer) EnviarAlteracao(_ context.Context, n outbound.NotificacaoAlteracao) error {
	body, err := m.renderer.RenderAlteracao(projetarAlteracao(n))
	if err != nil {
		return err
	}
	return m.gravar("Nova alteração — "+n.Protocolo, body, n.Protocolo)
}

// gravar escreve o corpo no caminho livre dentro de dir. O protocolo vem do
// DTO — não há parsing do assunto.
func (m *FileMailer) gravar(subject, body, protocolo string) error {
	if err := os.MkdirAll(m.dir, 0o755); err != nil {
		return fmt.Errorf("criar diretório de saída: %w", err)
	}
	path := m.nomeLivre(subject)
	if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
		return fmt.Errorf("gravar e-mail em arquivo: %w", err)
	}
	slog.Info("e-mail salvo em arquivo (dev sem SMTP)", "file", path, "protocolo", protocolo)
	return nil
}

// nomeLivre devolve um caminho livre dentro de dir no formato
// <YYYYMMDDTHHMMSSZ>_<slug-do-Subject>.html; em colisão, acrescenta um sufixo numérico.
func (m *FileMailer) nomeLivre(subject string) string {
	base := time.Now().UTC().Format("20060102T150405Z") + "_" + slugify(subject)
	candidate := filepath.Join(m.dir, base+".html")
	for i := 2; ; i++ {
		_, err := os.Stat(candidate)
		switch {
		case os.IsNotExist(err):
			return candidate
		case err == nil:
			candidate = filepath.Join(m.dir, fmt.Sprintf("%s_%d.html", base, i))
		default:
			return candidate // erro inesperado: deixar o WriteFile reportá-lo
		}
	}
}

var naoSlug = regexp.MustCompile(`[^a-z0-9]+`)

// slugify minúscula e substitui sequências de caracteres não alfanuméricos
// por um único hífen, gerando um nome de arquivo seguro.
func slugify(s string) string {
	s = naoSlug.ReplaceAllString(strings.ToLower(strings.TrimSpace(s)), "-")
	return strings.Trim(s, "-")
}
