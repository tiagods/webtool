package entity

// Prefixos de protocolo por formulário. O protocolo final tem o formato
// {prefix}{ano UTC}-{seq 6 dígitos} (ver outbound.ProtocoloCounter).
const (
	ProtocoloPrefixAbertura  = "PRO-"
	ProtocoloPrefixAlteracao = "ALT-"
)

// SubmissaoMessage é o corpo da mensagem publicada na fila SQS no submit de um
// formulário. O worker a consome para gerar o PDF e disparar o e-mail de
// notificação. As tags json são o contrato de wire com o worker.
type SubmissaoMessage struct {
	SessionID string           `json:"sessionId"`
	Protocolo string           `json:"protocolo"`
	FormType  FormType         `json:"formType"`
	Tipo      TipoConstituicao `json:"tipo,omitempty"`
}
