package inbound

import (
	"context"
	"encoding/json"

	"github.com/tiagods/webtool/apps/backend/domain/validation"
)

// SubmissaoUseCase finaliza uma ficha (rota POST /api/submit ou
// /api/alteracao/submit): valida o payload completo e, se válido, executa a
// finalização na ordem deliberada do serviço.
type SubmissaoUseCase interface {
	// Submeter devolve o protocolo quando a finalização termina, as issues
	// de validação quando o payload é inválido (o handler responde 400 com
	// elas no corpo) e err somente para falha de infraestrutura (→ 500).
	Submeter(ctx context.Context, sessionID string, raw json.RawMessage) (string, []validation.Issue, error)
}
