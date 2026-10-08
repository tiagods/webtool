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

func newTestMailer(t *testing.T, dir string) *FileMailer {
	t.Helper()
	r, err := NewRenderer()
	if err != nil {
		t.Fatalf("NewRenderer: %v", err)
	}
	return &FileMailer{dir: dir, renderer: r}
}

func notificacaoAberturaFixa() outbound.NotificacaoAbertura {
	return outbound.NotificacaoAbertura{
		Tipo: "Ltda", Protocolo: "20260923-001",
		RazaoSocial: "ACME Construções Ltda", CNPJ: "12.345.678/0001-90",
		DataHora: dataHoraFixo,
	}
}

var nomeArquivoRe = regexp.MustCompile(`^\d{8}T\d{6}Z_nova-abertura-20260923-001(-\d+)?\.html$`)

func TestFileMailer_EnviarAberturaGravaHTML(t *testing.T) {
	dir := t.TempDir()
	m := newTestMailer(t, dir)

	n := notificacaoAberturaFixa()
	if err := m.EnviarAbertura(context.Background(), n); err != nil {
		t.Fatalf("EnviarAbertura: %v", err)
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
	// O HTML completo é coberto pelo teste golden do Renderer; aqui só
	// verificamos que o corpo renderizado saiu com os dados do DTO.
	if !strings.Contains(string(conteudo), n.Protocolo) || !strings.Contains(string(conteudo), n.RazaoSocial) {
		t.Errorf("corpo não contém os dados da notificação: %q", conteudo)
	}
}

func TestFileMailer_CriaDiretorio(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "nao_existe", "emails")
	m := newTestMailer(t, dir)

	if err := m.EnviarAlteracao(context.Background(), outbound.NotificacaoAlteracao{
		Protocolo: "ALT-2026-000042", CNPJ: "98.765.432/0001-10", DataHora: dataHoraFixo,
	}); err != nil {
		t.Fatalf("EnviarAlteracao: %v", err)
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
	m := newTestMailer(t, dir)
	n := notificacaoAberturaFixa()

	if err := m.EnviarAbertura(context.Background(), n); err != nil {
		t.Fatalf("EnviarAbertura 1: %v", err)
	}
	if err := m.EnviarAbertura(context.Background(), n); err != nil {
		t.Fatalf("EnviarAbertura 2: %v", err)
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
