// Package requestcontext transporta metadados de correlação (correlation id,
// tenant, papéis) pelo context.Context de uma requisição. É um pacote puro:
// não conhece HTTP nem Echo.
package requestcontext

import "context"

// Nomes de header usados para propagar o contexto entre serviços.
const (
	HeaderCID    = "X-Cid"
	HeaderTenant = "X-Tenant"
)

// RequestContext agrupa os metadados de uma requisição em trânsito.
type RequestContext struct {
	CID    string
	Tenant string
	Roles  []string
}

// key é um tipo não exportado para evitar colisão de chaves no context.Context.
type key struct{}

// With devolve um context derivado carregando rc.
func With(ctx context.Context, rc RequestContext) context.Context {
	return context.WithValue(ctx, key{}, rc)
}

// From extrai o RequestContext de ctx. ok é false quando nenhum foi anexado.
func From(ctx context.Context) (rc RequestContext, ok bool) {
	rc, ok = ctx.Value(key{}).(RequestContext)
	return rc, ok
}

// CID devolve o correlation id de ctx, ou "" quando ausente.
func CID(ctx context.Context) string {
	rc, _ := From(ctx)
	return rc.CID
}
