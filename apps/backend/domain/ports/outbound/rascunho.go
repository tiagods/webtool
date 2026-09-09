// Package outbound declara os ports que o domínio usa para falar com sistemas
// externos (persistência, storage de objetos, publicação de eventos). São
// interfaces declaradas pelo consumidor; a camada infrastructure as implementa.
package outbound

import (
	"context"
	"encoding/json"

	"github.com/tiagods/webtool/apps/backend/domain/entity"
)

// RascunhoRepository persiste o item de rascunho de uma sessão de formulário.
// Cada instância opera sobre uma única tabela (abertura ou alteração) — a tabela
// é fixada na construção do adapter, não passada por chamada.
type RascunhoRepository interface {
	// Get devolve o rascunho da sessão, ou (nil, nil) se não existir.
	Get(ctx context.Context, sessionID string) (*entity.Rascunho, error)

	// EnsureInicial cria o item de rascunho na primeira vez que a sessão é
	// gerada. Idempotente (if_not_exists) — seguro chamar a cada sessão nova.
	EnsureInicial(ctx context.Context, sessionID string) error

	// PutPayload grava o payload validado do formulário e renova o TTL para 2h,
	// sem alterar o status. tipo vazio ("") deixa o campo denormalizado intacto.
	PutPayload(ctx context.Context, sessionID string, payload json.RawMessage, tipo entity.TipoConstituicao) error

	// PutDocumentoKey registra a key S3 de um documento confirmado, mesclando no
	// mapa documentosKeys sem afetar os demais campos.
	PutDocumentoKey(ctx context.Context, sessionID, campo, key string) error

	// MarcarEnviado transiciona o status para enviado e, no mesmo UpdateItem,
	// zera payload e documentosKeys e redefine o TTL para 30 dias.
	MarcarEnviado(ctx context.Context, sessionID, protocolo string, tipo entity.TipoConstituicao) error

	// Delete apaga o item de rascunho (exclusão sob solicitação, LGPD Art. 18).
	Delete(ctx context.Context, sessionID string) error
}
