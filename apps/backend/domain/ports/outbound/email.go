package outbound

import (
	"context"
)

// EmailData carrega os dados necessários para montar e enviar o e-mail de
// notificação de submissão de formulário.
type EmailData struct {
	To           string
	Subject      string
	BodyHTML     string
	Documentos   []AnexoInfo
}

// AnexoInfo descreve um documento do S3 que vai ser anexado ao e-mail.
type AnexoInfo struct {
	Nome      string // nome amigável para exibição (ex: "RG Frente - Sócio 1")
	Filename  string // nome do arquivo para o anexo (ex: "socio_0_rg_frente.pdf")
	S3Key     string // key no bucket S3
	ContentType string
}

// EmailSender envia e-mail de notificação com dados do formulário submetido.
// Os documentos do S3 são enviados como presigned URLs no corpo HTML, não como
// anexos — evita estourar o limite de ~25MB do SMTP.
type EmailSender interface {
	// Send envia o e-mail com os links presigned no corpo HTML.
	Send(ctx context.Context, data EmailData) error
}