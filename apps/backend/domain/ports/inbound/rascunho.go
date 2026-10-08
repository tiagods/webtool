package inbound

import (
	"context"
	"encoding/json"

	"github.com/tiagods/webtool/apps/backend/domain/entity"
	"github.com/tiagods/webtool/apps/backend/domain/validation"
)

// RascunhoUseCase cobre as operações de rascunho ligadas às rotas GET/POST
// /api/draft e /api/alteracao/draft: leitura do rascunho e gravação do
// payload parcial validado.
type RascunhoUseCase interface {
	// Buscar devolve o rascunho salvo da sessão, ou nil se ainda não houver
	// item.
	Buscar(ctx context.Context, sessionID string) (*entity.Rascunho, error)

	// Salvar valida o rascunho parcial e persiste o payload, renovando o
	// TTL. As issues de validação são devolvidas para o handler responder
	// 400 com elas no corpo; o erro só sinaliza falha de infraestrutura.
	Salvar(ctx context.Context, sessionID string, raw json.RawMessage) ([]validation.Issue, error)
}
