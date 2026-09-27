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

// FileMailer implementa outbound.EmailSender gravando o e-mail como arquivo
// HTML em disco. É o fallback de dev sem SMTP: permite inspecionar a
// notificação no navegador sem servidor de e-mail.
type FileMailer struct {
	dir string
}

var _ outbound.EmailSender = (*FileMailer)(nil)

// NewFileMailer cria um remetente que grava os e-mails em dir (criada se não
// existir).
func NewFileMailer(dir string) *FileMailer {
	return &FileMailer{dir: dir}
}

// Send grava o mesmo HTML que o e-mail SMTP levaria (links presigned incluídos)
// em <dir>/<YYYYMMDDTHHMMSSZ>_<slug-do-Subject>.html.
func (m *FileMailer) Send(_ context.Context, data outbound.EmailData) error {
	if err := os.MkdirAll(m.dir, 0o755); err != nil {
		return fmt.Errorf("criar diretório de saída: %w", err)
	}
	path := m.nomeLivre(data.Subject)
	if err := os.WriteFile(path, []byte(data.BodyHTML), 0o644); err != nil {
		return fmt.Errorf("gravar e-mail em arquivo: %w", err)
	}
	slog.Info("e-mail salvo em arquivo (dev sem SMTP)", "file", path, "protocolo", protocoloDoAssunto(data.Subject))
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

// protocoloDoAssunto extrai o protocolo do fim do assunto (ex:
// "Nova abertura — 20260923-001" → "20260923-001").
func protocoloDoAssunto(subject string) string {
	const dash = "—"
	if i := strings.LastIndex(subject, dash); i >= 0 && i+len(dash) < len(subject) {
		return strings.TrimSpace(subject[i+len(dash):])
	}
	return subject
}

var naoSlug = regexp.MustCompile(`[^a-z0-9]+`)

// slugify minúscula e substitui sequências de caracteres não alfanuméricos
// por um único hífen, gerando um nome de arquivo seguro.
func slugify(s string) string {
	s = naoSlug.ReplaceAllString(strings.ToLower(strings.TrimSpace(s)), "-")
	return strings.Trim(s, "-")
}
