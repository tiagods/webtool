package inbound

import "context"

// DocumentoUseCase cobre o ciclo de upload de documentos (rota
// POST /api/upload-url): validação do pedido, URL pré-assinada para o S3 e
// confirmação de que o documento foi enviado.
type DocumentoUseCase interface {
	// ValidarPedido checa campo e content-type sem tocar em I/O.
	ValidarPedido(campo, contentType string) error

	// PresignarDocumento valida campo e content-type e devolve uma URL PUT
	// assinada para a key da sessão.
	PresignarDocumento(ctx context.Context, sessionID, campo, contentType string) (string, error)

	// ConfirmarUpload registra a key S3 de um documento confirmado como
	// enviado.
	ConfirmarUpload(ctx context.Context, sessionID, campo, contentType string) error
}
