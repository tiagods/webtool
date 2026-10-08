// Package inbound declara os ports que a camada web (handlers, guards e
// router) usa para invocar os casos de uso do domínio. São as interfaces
// declaradas pelo consumidor: domain/service as implementa, o adapter web as
// consome. É a fronteira de entrada — o inverso de ports/outbound (fronteira
// de saída, implementada por infrastructure).
//
// Exceção registrada em boas-praticas-go: inbound pode importar
// domain/validation — Salvar/Submeter devolvem as issues de validação para o
// handler responder 400.
package inbound

import (
	"context"
)

// AceiteUseCase registra o aceite do termo de consentimento LGPD de uma sessão.
type AceiteUseCase interface {
	// RegistrarAceite valida a versão do termo, persiste o registro (com um
	// sessionID novo) e devolve o token assinado do cookie prolink_aceite.
	RegistrarAceite(ctx context.Context, versaoTermo, ip, userAgent string) (string, error)
}
