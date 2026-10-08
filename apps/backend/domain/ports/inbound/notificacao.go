package inbound

import (
	"context"

	"github.com/tiagods/webtool/apps/backend/domain/entity"
)

// NotificacaoUseCase consome as mensagens de submissão da fila e dispara a
// notificação interna correspondente.
type NotificacaoUseCase interface {
	// Processar monta e envia a notificação da submissão conforme o
	// formType da mensagem.
	Processar(ctx context.Context, msg entity.SubmissaoMessage) error
}
