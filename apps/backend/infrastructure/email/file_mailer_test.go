package email

import (
	"context"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/tiagods/webtool/apps/backend/domain/ports/outbound"
)

var nomeArquivoRe = regexp.MustCompile(`^\d{8}T\d{6}Z_nova-abertura-20260923-001(-\d+)?\.html$`)

func TestFileMailer_SendGravaHTML(t *testing.T) {
	dir := t.TempDir()
	m := NewFileMailer(dir)

	data := outbound.EmailData{
		To:       "dest@example.com",
		Subject:  "Nova abertura — 20260923-001",
		BodyHTML: "<html><body>ficha</body></html>",
	}
	if err := m.Send(context.Background(), data); err != nil {
		t.Fatalf("Send: %v", err)
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("ReadDir: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("arquivos criados = %d, esperado 1", len(entries))
	}
	name := entries[0].Name()
	if !nomeArquivoRe.MatchString(name) || !strings.HasSuffix(name, ".html") {
		t.Errorf("nome = %q, esperado <YYYYMMDDTHHMMSSZ>_<slug>.html", name)
	}

	conteudo, err := os.ReadFile(filepath.Join(dir, name))
	if err != nil {
		t.Fatalf("ReadFile: %v", err)
	}
	if string(conteudo) != data.BodyHTML {
		t.Errorf("conteudo = %q, esperado %q", conteudo, data.BodyHTML)
	}
}

func TestFileMailer_CriaDiretorio(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "nao_existe", "emails")
	m := NewFileMailer(dir)

	if err := m.Send(context.Background(), outbound.EmailData{
		Subject:  "Nova alteração — ALT-2026-000042",
		BodyHTML: "<html>alteracao</html>",
	}); err != nil {
		t.Fatalf("Send: %v", err)
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("ReadDir: %v", err)
	}
	t.Logf("Diretório: %s", dir)
	if len(entries) != 1 {
		t.Fatalf("arquivos = %d, esperado 1", len(entries))
	}
}

func TestFileMailer_NaoSobrescreveEmColisao(t *testing.T) {
	dir := t.TempDir()
	m := NewFileMailer(dir)
	data := outbound.EmailData{Subject: "Nova abertura — 20260923-001", BodyHTML: "<html>1</html>"}

	if err := m.Send(context.Background(), data); err != nil {
		t.Fatalf("Send 1: %v", err)
	}
	data.BodyHTML = "<html>2</html>"
	if err := m.Send(context.Background(), data); err != nil {
		t.Fatalf("Send 2: %v", err)
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("ReadDir: %v", err)
	}
	if len(entries) != 2 {
		t.Fatalf("arquivos = %d, esperado 2 (sem sobrescrever)", len(entries))
	}
}

func TestSlugify(t *testing.T) {
	cases := []struct{ in, want string }{
		{"20260923-001", "20260923-001"},
		{"Nova Abertura — 20260923-001", "nova-abertura-20260923-001"},
		{"A/B C_D  E", "a-b-c-d-e"},
	}
	for _, c := range cases {
		if got := slugify(c.in); got != c.want {
			t.Errorf("slugify(%q) = %q, esperado %q", c.in, got, c.want)
		}
	}
}

func TestProtocoloDoAssunto(t *testing.T) {
	cases := []struct{ in, want string }{
		{"Nova abertura — 20260923-001", "20260923-001"},
		{"Nova alteração — ALT-2026-000042", "ALT-2026-000042"},
		{"sem protocolo", "sem protocolo"},
	}
	for _, c := range cases {
		if got := protocoloDoAssunto(c.in); got != c.want {
			t.Errorf("protocoloDoAssunto(%q) = %q, esperado %q", c.in, got, c.want)
		}
	}
}
