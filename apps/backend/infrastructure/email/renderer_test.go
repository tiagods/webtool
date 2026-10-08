package email

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/tiagods/webtool/apps/backend/domain/ports/outbound"
)

// dataHoraFixo é o mesmo instante usado para gerar os goldens de testdata/
// (capturados com a implementação pré-refator do batch 039). A comparação
// byte a byte prova que a refator não alterou o HTML do e-mail.
var dataHoraFixo = time.Date(2026, 9, 23, 12, 0, 0, 0, time.UTC)

func goldenDTOAbertura() outbound.NotificacaoAbertura {
	return outbound.NotificacaoAbertura{
		Tipo:             "Ltda",
		RazaoSocial:      "ACME Construções Ltda",
		NomeFantasia:     "ACME",
		CNPJ:             "12.345.678/0001-90",
		NaturezaJuridica: "Sociedade Empresária Limitada",
		Logradouro:       "Av. Paulista",
		Numero:           "1000",
		Bairro:           "Bela Vista",
		Municipio:        "São Paulo",
		UF:               "SP",
		CEP:              "01310-100",
		CapitalSocial:    "100.000,00",
		Administracao:    "Sócios",
		Socios: []outbound.SocioNotificacao{
			{Nome: "Maria da Silva", CPF: "123.456.789-00", Email: "maria@acme.com", Qualificacao: "Sócia-Administradora", ProLabore: "5.000,00"},
			{Nome: "João Souza", CPF: "987.654.321-00", Email: "joao@acme.com", Qualificacao: "Sócio", ProLabore: "—"},
		},
		Documentos: []outbound.DocumentoLink{
			{Label: "Contrato Social", URL: "https://s3.local/prolink/s1/documentos/contrato_social.pdf?X-Amz-Signature=abc123"},
			{Label: "RG Frente (Sócio 1)", URL: "https://s3.local/prolink/s1/documentos/rg.png?X-Amz-Signature=def456"},
		},
		Protocolo: "PRO-2026-000999",
		DataHora:  dataHoraFixo,
	}
}

func goldenDTOAlteracao() outbound.NotificacaoAlteracao {
	return outbound.NotificacaoAlteracao{
		CNPJ:        "98.765.432/0001-10",
		RazaoSocial: "ACME Construções Ltda",
		Situacao:    "Ativa",
		Quadros:     []string{"Sócios", "Objeto Social"},
		Protocolo:   "ALT-2026-000042",
		DataHora:    dataHoraFixo,
	}
}

func TestRenderer_GoldenAbertura(t *testing.T) {
	r, err := NewRenderer()
	if err != nil {
		t.Fatalf("NewRenderer: %v", err)
	}

	got, err := r.RenderAbertura(projetarAbertura(goldenDTOAbertura()))
	if err != nil {
		t.Fatalf("RenderAbertura: %v", err)
	}
	want, err := os.ReadFile(filepath.Join("testdata", "golden_abertura.html"))
	if err != nil {
		t.Fatalf("ler golden: %v", err)
	}
	if !bytes.Equal([]byte(got), want) {
		t.Fatalf("HTML da abertura diverge do golden pré-refator:\n%s", primeiraDivergencia(string(want), got))
	}
}

func TestRenderer_GoldenAlteracao(t *testing.T) {
	r, err := NewRenderer()
	if err != nil {
		t.Fatalf("NewRenderer: %v", err)
	}

	got, err := r.RenderAlteracao(projetarAlteracao(goldenDTOAlteracao()))
	if err != nil {
		t.Fatalf("RenderAlteracao: %v", err)
	}
	want, err := os.ReadFile(filepath.Join("testdata", "golden_alteracao.html"))
	if err != nil {
		t.Fatalf("ler golden: %v", err)
	}
	if !bytes.Equal([]byte(got), want) {
		t.Fatalf("HTML da alteração diverge do golden pré-refator:\n%s", primeiraDivergencia(string(want), got))
	}
}

// primeiraDivergencia devolve a primeira linha em que want e got diferem
// (diagnóstico do teste golden).
func primeiraDivergencia(want, got string) string {
	wl, gl := strings.Split(want, "\n"), strings.Split(got, "\n")
	n := len(wl)
	if len(gl) < n {
		n = len(gl)
	}
	for i := 0; i < n; i++ {
		if wl[i] != gl[i] {
			return fmt.Sprintf("linha %d:\nwant: %s\ngot:  %s", i+1, wl[i], gl[i])
		}
	}
	return fmt.Sprintf("mesmas primeiras %d linhas; comprimentos diferem (want=%d bytes, got=%d bytes)", n, len(want), len(got))
}
