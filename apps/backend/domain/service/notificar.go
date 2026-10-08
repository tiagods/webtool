package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/tiagods/webtool/apps/backend/domain/entity"
	"github.com/tiagods/webtool/apps/backend/domain/ports/inbound"
	"github.com/tiagods/webtool/apps/backend/domain/ports/outbound"
)

// PresignedDownloadExpiraEm é a validade das URLs de download dos documentos na
// notificação de submissão.
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

// NotificarSubmissao consome a mensagem de submissão e notifica a empresa:
// extrai os dados do payload, gera os links de download dos documentos e
// delega ao NotificacaoSender — canal (e-mail, evento, …) é decisão do adapter
// de infraestrutura, não do serviço.
type NotificarSubmissao struct {
	rascunhos outbound.RascunhoRepository
	storage   outbound.DocumentoStorage
	notificar outbound.NotificacaoSender
}

// NewNotificarSubmissao injeta o repositório, o storage e o sender de
// notificação.
func NewNotificarSubmissao(r outbound.RascunhoRepository, s outbound.DocumentoStorage, n outbound.NotificacaoSender) *NotificarSubmissao {
	return &NotificarSubmissao{rascunhos: r, storage: s, notificar: n}
}

var _ inbound.NotificacaoUseCase = (*NotificarSubmissao)(nil)

// Processar monta a notificação conforme o formType e envia pelo canal
// configurado.
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
	n, err := extrairAbertura(r.Payload)
	if err != nil {
		return err
	}
	n.Documentos, err = ns.gerarLinks(ctx, r.DocumentosKeys)
	if err != nil {
		return err
	}
	n.Protocolo = msg.Protocolo
	n.DataHora = time.Now().UTC()
	return ns.notificar.EnviarAbertura(ctx, n)
}

func (ns *NotificarSubmissao) processarAlteracao(ctx context.Context, msg entity.SubmissaoMessage, r *entity.Rascunho) error {
	n, err := extrairAlteracao(r.Payload)
	if err != nil {
		return err
	}
	n.Documentos, err = ns.gerarLinks(ctx, r.DocumentosKeys)
	if err != nil {
		return err
	}
	n.Protocolo = msg.Protocolo
	n.DataHora = time.Now().UTC()
	return ns.notificar.EnviarAlteracao(ctx, n)
}

func (ns *NotificarSubmissao) gerarLinks(ctx context.Context, docs map[string]string) ([]outbound.DocumentoLink, error) {
	lns := make([]outbound.DocumentoLink, 0, len(docs))
	for campo, s3key := range docs {
		url, err := ns.storage.PresignedDownloadURL(ctx, s3key, PresignedDownloadExpiraEm)
		if err != nil {
			return nil, fmt.Errorf("URL download %q: %w", campo, err)
		}
		lns = append(lns, outbound.DocumentoLink{Label: labelDoc(campo), URL: url})
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

func extrairAbertura(raw json.RawMessage) (outbound.NotificacaoAbertura, error) {
	var p aberturaPayload
	if err := json.Unmarshal(raw, &p); err != nil {
		return outbound.NotificacaoAbertura{}, fmt.Errorf("payload abertura: %w", err)
	}
	tipo := "Ltda"
	if p.TipoConstituicao == "slu" {
		tipo = "SLU"
	}
	ss := make([]outbound.SocioNotificacao, 0, len(p.Socios))
	for _, s := range p.Socios {
		ss = append(ss, outbound.SocioNotificacao{
			Nome: s.Nome, CPF: s.CPF, Email: s.Email,
			Qualificacao: s.Qualificacao, ProLabore: s.ProLabore,
		})
	}
	return outbound.NotificacaoAbertura{
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

func extrairAlteracao(raw json.RawMessage) (outbound.NotificacaoAlteracao, error) {
	var p alteracaoPayload
	if err := json.Unmarshal(raw, &p); err != nil {
		return outbound.NotificacaoAlteracao{}, fmt.Errorf("payload alteração: %w", err)
	}
	return outbound.NotificacaoAlteracao{
		CNPJ: p.CNPJ, RazaoSocial: p.RazaoSocial,
		Situacao: p.Situacao, Quadros: p.Quadros,
	}, nil
}
