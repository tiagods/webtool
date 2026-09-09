package outbound

import (
	"context"

	"github.com/tiagods/webtool/apps/backend/domain/entity"
)

// SubmissaoPublisher publica a mensagem de submit na fila que o worker consome.
type SubmissaoPublisher interface {
	Publish(ctx context.Context, msg entity.SubmissaoMessage) error
}
