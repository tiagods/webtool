package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/tiagods/webtool/apps/backend/domain/entity"
	"github.com/tiagods/webtool/apps/backend/domain/ports/outbound"
	"github.com/tiagods/webtool/apps/backend/infrastructure/email"
)

// PresignedDownloadExpiraEm é a validade das URLs de download dos documentos no
// e-mail de notificação.
const PresignedDownloadExpiraEm = 7 * 24 * time.Hour

var labelMap = map[string]string{
	"socio_N_rg_frente":             "RG Frente",
	"socio_N_rg_verso":              "RG Verso",
	"socio_N_cpf":                   "CPF",
	"socio_N_comprovanteResidencia": "Comprovante Residência",
	"socio_N_irpf2024":              "IRPF 2024",
	"socio_N_irpf2025":              "IRPF 2025",
	"socio_N_tituloEleitor":         "Título Eleitor",
	"socio_N_certidaoCasamento":     "Certidão Casamento",
	"socio_N_registroProfissional":  "Registro Profissional",
	"imovel_iptu":                   "IPTU",
	"imovel_contratoLocacao":        "Contrato Locação",
}

func labelDoc(campo string) string {
	lbl, ok := labelMap[campo]
	if !ok {
		return campo
	}
	var idx int
	if n, _ := fmt.Sscanf(campo, "socio_%d_", &idx); n == 1 {
		return fmt.Sprintf("%s (Sócio %d)", lbl, idx+1)
	}
	return lbl
}

// NotificarSubmissao consome a mensagem de submissão e envia o e-mail com os
// links de download dos documentos.
type NotificarSubmissao struct {
	rascunhos outbound.RascunhoRepository
	storage   outbound.DocumentoStorage
	email     outbound.EmailSender
	to        string
}

// NewNotificarSubmissao injeta o repositório, o storage, o sender de e-mail e o
// destinatário interno.
func NewNotificarSubmissao(r outbound.RascunhoRepository, s outbound.DocumentoStorage, m outbound.EmailSender, to string) *NotificarSubmissao {
	return &NotificarSubmissao{rascunhos: r, storage: s, email: m, to: to}
}

// Processar monta e envia a notificação da submissão conforme o formType.
func (ns *NotificarSubmissao) Processar(ctx context.Context, msg entity.SubmissaoMessage) error {
	r, err := ns.rascunhos.Get(ctx, msg.SessionID)
	if err != nil {
		return fmt.Errorf("buscar rascunho: %w", err)
	}
	if r == nil || r.Payload == nil {
		return nil
	}
	switch msg.FormType {
	case entity.FormAbertura:
		return ns.processarAbertura(ctx, msg, r)
	case entity.FormAlteracao:
		return ns.processarAlteracao(ctx, msg, r)
	default:
		return fmt.Errorf("formType desconhecido: %s", msg.FormType)
	}
}

func (ns *NotificarSubmissao) processarAbertura(ctx context.Context, msg entity.SubmissaoMessage, r *entity.Rascunho) error {
	d, err := extrairAbertura(r.Payload)
	if err != nil {
		return err
	}
	lns, err := ns.gerarLinks(ctx, r.DocumentosKeys)
	if err != nil {
		return err
	}
	d.Documentos = lns
	d.Protocolo = msg.Protocolo
	d.DataHora = email.FormatarDataHora()
	body, err := email.RenderAbertura(*d)
	if err != nil {
		return err
	}
	return ns.email.Send(ctx, outbound.EmailData{
		To: ns.to, Subject: "Nova abertura — " + msg.Protocolo, BodyHTML: body,
	})
}

func (ns *NotificarSubmissao) processarAlteracao(ctx context.Context, msg entity.SubmissaoMessage, r *entity.Rascunho) error {
	d, err := extrairAlteracao(r.Payload)
	if err != nil {
		return err
	}
	lns, err := ns.gerarLinks(ctx, r.DocumentosKeys)
	if err != nil {
		return err
	}
	d.Documentos = lns
	d.Protocolo = msg.Protocolo
	d.DataHora = email.FormatarDataHora()
	body, err := email.RenderAlteracao(*d)
	if err != nil {
		return err
	}
	return ns.email.Send(ctx, outbound.EmailData{
		To: ns.to, Subject: "Nova alteração — " + msg.Protocolo, BodyHTML: body,
	})
}

func (ns *NotificarSubmissao) gerarLinks(ctx context.Context, docs map[string]string) ([]email.DocLink, error) {
	lns := make([]email.DocLink, 0, len(docs))
	for campo, s3key := range docs {
		url, err := ns.storage.PresignedDownloadURL(ctx, s3key, PresignedDownloadExpiraEm)
		if err != nil {
			return nil, fmt.Errorf("URL download %q: %w", campo, err)
		}
		lns = append(lns, email.DocLink{Label: labelDoc(campo), URL: url})
	}
	return lns, nil
}

type aberturaPayload struct {
	RazaoSocial      string         `json:"razaoSocial"`
	NomeFantasia     string         `json:"nomeFantasia"`
	CNPJ             string         `json:"cnpj"`
	NaturezaJuridica string         `json:"naturezaJuridica"`
	TipoConstituicao string         `json:"tipoConstituicao"`
	Logradouro       string         `json:"logradouro"`
	Numero           string         `json:"numero"`
	Bairro           string         `json:"bairro"`
	Municipio        string         `json:"municipio"`
	UF               string         `json:"estado"`
	CEP              string         `json:"cep"`
	CapitalSocial    string         `json:"capitalSocial"`
	Administracao    string         `json:"tipoAdministracao"`
	Socios           []socioPayload `json:"socios"`
}

type socioPayload struct {
	Nome         string `json:"nome"`
	CPF          string `json:"cpf"`
	Email        string `json:"email"`
	Qualificacao string `json:"qualificacao"`
	ProLabore    string `json:"proLabore"`
}

func extrairAbertura(raw json.RawMessage) (*email.DadosEmailAbertura, error) {
	var p aberturaPayload
	if err := json.Unmarshal(raw, &p); err != nil {
		return nil, fmt.Errorf("payload abertura: %w", err)
	}
	tipo := "Ltda"
	if p.TipoConstituicao == "slu" {
		tipo = "SLU"
	}
	ss := make([]email.SocioEmail, 0, len(p.Socios))
	for _, s := range p.Socios {
		ss = append(ss, email.SocioEmail{
			Nome: s.Nome, CPF: s.CPF, Email: s.Email,
			Qualificacao: s.Qualificacao, ProLabore: s.ProLabore,
		})
	}
	return &email.DadosEmailAbertura{
		Tipo: tipo, RazaoSocial: p.RazaoSocial, NomeFantasia: p.NomeFantasia,
		CNPJ: p.CNPJ, NaturezaJuridica: p.NaturezaJuridica,
		Logradouro: p.Logradouro, Numero: p.Numero, Bairro: p.Bairro,
		Municipio: p.Municipio, UF: p.UF, CEP: p.CEP,
		CapitalSocial: p.CapitalSocial, Administracao: p.Administracao,
		Socios: ss,
	}, nil
}

type alteracaoPayload struct {
	CNPJ        string   `json:"cnpj"`
	RazaoSocial string   `json:"razaoSocial"`
	Situacao    string   `json:"situacao"`
	Quadros     []string `json:"quadros"`
}

func extrairAlteracao(raw json.RawMessage) (*email.DadosEmailAlteracao, error) {
	var p alteracaoPayload
	if err := json.Unmarshal(raw, &p); err != nil {
		return nil, fmt.Errorf("payload alteração: %w", err)
	}
	return &email.DadosEmailAlteracao{
		CNPJ: p.CNPJ, RazaoSocial: p.RazaoSocial,
		Situacao: p.Situacao, Quadros: p.Quadros,
	}, nil
}
