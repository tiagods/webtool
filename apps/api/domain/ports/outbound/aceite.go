package outbound

import (
	"context"

	"github.com/tiagods/webtool/apps/api/domain/entity"
)

// AceiteRepository persiste os registros de aceite do termo LGPD numa tabela
// própria, com retenção de 5 anos (TTL calculado pelo adapter a partir de
// RegistroAceite.AceitoEm).
type AceiteRepository interface {
	Put(ctx context.Context, registro entity.RegistroAceite) error
}
