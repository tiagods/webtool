package email

import (
	"bytes"
	"embed"
	"fmt"
	"html/template"

	"github.com/tiagods/webtool/apps/backend/domain/ports/outbound"
)

//go:embed templates/*.html
var templateFS embed.FS

// layoutDataHora é o formato de exibição da data/hora no corpo do e-mail. A
// formatação é responsabilidade do adapter — o contrato outbound trafega
// time.Time (mesmo layout do FormatarDataHora pré-refator).
const layoutDataHora = "02/01/2006 15:04 MST"

// dadosAbertura/dadosAlteracao são os modelos de exibição dos templates — a
// projeção interna do DTO outbound (DataHora já formatado). Não fazem parte
// do contrato de fronteira; os nomes dos campos espelham o contrato para o
// template.
type dadosAbertura struct {
	Protocolo        string
	Tipo             string
	RazaoSocial      string
	NomeFantasia     string
	CNPJ             string
	NaturezaJuridica string
	Logradouro       string
	Numero           string
	Bairro           string
	Municipio        string
	UF               string
	CEP              string
	CapitalSocial    string
	Administracao    string
	Socios           []socioEmail
	Documentos       []docLink
	DataHora         string
}

type socioEmail struct {
	Nome         string
	CPF          string
	Email        string
	Qualificacao string
	ProLabore    string
}

type dadosAlteracao struct {
	Protocolo        string
	CNPJ             string
	RazaoSocial      string
	Situacao         string
	Quadros          []string
	ResumoAlteracoes string
	Documentos       []docLink
	DataHora         string
}

type docLink struct {
	Label string // ex: "RG Frente (Sócio 1)"
	URL   string // presigned GET URL
}

// Renderer renderiza os templates HTML das notificações. Os templates são
// parseados no construtor (erro devolvido ao caller) — não há init() nem
// variável de pacote global.
type Renderer struct {
	templates *template.Template
}

// NewRenderer carrega e parseia os templates embutidos.
func NewRenderer() (*Renderer, error) {
	templates, err := template.ParseFS(templateFS, "templates/*.html")
	if err != nil {
		return nil, fmt.Errorf("parsear templates: %w", err)
	}
	return &Renderer{templates: templates}, nil
}

// RenderAbertura renderiza o template HTML de notificação de abertura.
func (r *Renderer) RenderAbertura(d dadosAbertura) (string, error) {
	var buf bytes.Buffer
	if err := r.templates.ExecuteTemplate(&buf, "abertura", d); err != nil {
		return "", fmt.Errorf("executar template abertura: %w", err)
	}
	return buf.String(), nil
}

// RenderAlteracao renderiza o template HTML de notificação de alteração.
func (r *Renderer) RenderAlteracao(d dadosAlteracao) (string, error) {
	var buf bytes.Buffer
	if err := r.templates.ExecuteTemplate(&buf, "alteracao", d); err != nil {
		return "", fmt.Errorf("executar template alteracao: %w", err)
	}
	return buf.String(), nil
}

// projetarAbertura converte o DTO outbound para o modelo de exibição
// (DataHora formatado para o layout do template).
func projetarAbertura(n outbound.NotificacaoAbertura) dadosAbertura {
	ss := make([]socioEmail, 0, len(n.Socios))
	for _, s := range n.Socios {
		ss = append(ss, socioEmail{
			Nome: s.Nome, CPF: s.CPF, Email: s.Email,
			Qualificacao: s.Qualificacao, ProLabore: s.ProLabore,
		})
	}
	docs := make([]docLink, 0, len(n.Documentos))
	for _, d := range n.Documentos {
		docs = append(docs, docLink{Label: d.Label, URL: d.URL})
	}
	return dadosAbertura{
		Protocolo: n.Protocolo, Tipo: n.Tipo,
		RazaoSocial: n.RazaoSocial, NomeFantasia: n.NomeFantasia,
		CNPJ: n.CNPJ, NaturezaJuridica: n.NaturezaJuridica,
		Logradouro: n.Logradouro, Numero: n.Numero, Bairro: n.Bairro,
		Municipio: n.Municipio, UF: n.UF, CEP: n.CEP,
		CapitalSocial: n.CapitalSocial, Administracao: n.Administracao,
		Socios: ss, Documentos: docs,
		DataHora: n.DataHora.Format(layoutDataHora),
	}
}

// projetarAlteracao converte o DTO outbound para o modelo de exibição.
func projetarAlteracao(n outbound.NotificacaoAlteracao) dadosAlteracao {
	docs := make([]docLink, 0, len(n.Documentos))
	for _, d := range n.Documentos {
		docs = append(docs, docLink{Label: d.Label, URL: d.URL})
	}
	return dadosAlteracao{
		Protocolo: n.Protocolo, CNPJ: n.CNPJ, RazaoSocial: n.RazaoSocial,
		Situacao: n.Situacao, Quadros: n.Quadros, Documentos: docs,
		DataHora: n.DataHora.Format(layoutDataHora),
	}
}
