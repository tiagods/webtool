package outbound

import (
	"context"
	"time"
)

// NotificacaoSender entrega a notificação de uma submissão ao canal configurado
// (SMTP ou arquivo, conforme config). O adapter monta o assunto, renderiza o
// HTML e aplica o destino; o domínio só descreve o fato de negócio.
type NotificacaoSender interface {
	EnviarAbertura(ctx context.Context, n NotificacaoAbertura) error
	EnviarAlteracao(ctx context.Context, n NotificacaoAlteracao) error
}

// NotificacaoAbertura é o objeto de fronteira da notificação de abertura — o
// e-mail descreve a ficha protocolada. DataHora é a data/hora do envio (UTC);
// a formatação para exibição fica no adapter.
type NotificacaoAbertura struct {
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
	Socios           []SocioNotificacao
	Documentos       []DocumentoLink
	Protocolo        string
	DataHora         time.Time
}

// SocioNotificacao descreve um sócio da ficha para a notificação.
type SocioNotificacao struct {
	Nome         string
	CPF          string
	Email        string
	Qualificacao string
	ProLabore    string
}

// NotificacaoAlteracao é o objeto de fronteira da notificação de alteração.
type NotificacaoAlteracao struct {
	Protocolo        string
	CNPJ             string
	RazaoSocial      string
	Situacao         string
	Quadros          []string
	ResumoAlteracoes string
	Documentos       []DocumentoLink
	DataHora         time.Time
}

// DocumentoLink é um documento da ficha com sua URL de download assinada.
type DocumentoLink struct {
	Label string
	URL   string
}
