// Package email implementa outbound.EmailSender via SMTP com conteúdo HTML.
package email

import (
	"embed"
	"fmt"
	"html/template"
	"time"
)

//go:embed templates/*.html
var templatesFS embed.FS

// templates carregados uma vez na inicialização.
var templates *template.Template

func init() {
	templates = template.Must(template.ParseFS(templatesFS, "templates/*.html"))
}

// DadosEmailAbertura são os dados do template de e-mail de abertura.
type DadosEmailAbertura struct {
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
	Socios           []SocioEmail
	Documentos       []DocLink
	DataHora         string
}

// SocioEmail são os dados de um sócio exibidos no e-mail.
type SocioEmail struct {
	Nome          string
	CPF           string
	Email         string
	Qualificacao  string
	ProLabore     string
}

// DocLink é um link presigned gerado para download de documento.
type DocLink struct {
	Label string // ex: "RG Frente (Sócio 1)"
	URL   string // presigned GET URL
}

// DadosEmailAlteracao são os dados do template de e-mail de alteração.
type DadosEmailAlteracao struct {
	Protocolo        string
	CNPJ             string
	RazaoSocial      string
	Situacao         string
	Quadros          []string
	ResumoAlteracoes string
	Documentos       []DocLink
	DataHora         string
}

// RenderAbertura renderiza o template HTML de notificação de abertura.
func RenderAbertura(d DadosEmailAbertura) (string, error) {
	var buf templateToString
	err := templates.ExecuteTemplate(&buf, "abertura", d)
	if err != nil {
		return "", fmt.Errorf("renderizar template abertura: %w", err)
	}
	return buf.String(), nil
}

// RenderAlteracao renderiza o template HTML de notificação de alteração.
func RenderAlteracao(d DadosEmailAlteracao) (string, error) {
	var buf templateToString
	err := templates.ExecuteTemplate(&buf, "alteracao", d)
	if err != nil {
		return "", fmt.Errorf("renderizar template alteracao: %w", err)
	}
	return buf.String(), nil
}

// templateToString é um writer simples que acumula a saída do template.
type templateToString struct {
	data []byte
}

func (w *templateToString) Write(p []byte) (int, error) {
	w.data = append(w.data, p...)
	return len(p), nil
}

func (w *templateToString) String() string {
	return string(w.data)
}

// FormatarDataHora devolve a data/hora atual formatada para exibição no e-mail.
func FormatarDataHora() string {
	return time.Now().UTC().Format("02/01/2006 15:04 MST")
}