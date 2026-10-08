package handler

import (
	"github.com/tiagods/webtool/apps/backend/domain/ports/inbound"
	"github.com/tiagods/webtool/apps/backend/infrastructure/auth"
)

// Handlers agrupa os ports de entrada (casos de uso do domínio) e utilitários
// de transporte usados pelos handlers HTTP. Construído no ponto de composição
// (StartApp).
type Handlers struct {
	aceite            inbound.AceiteUseCase
	sessao            inbound.SessaoUseCase
	cookies           *auth.CookieBuilder
	rascunho          inbound.RascunhoUseCase
	upload            inbound.DocumentoUseCase
	submit            inbound.SubmissaoUseCase
	rascunhoAlteracao inbound.RascunhoUseCase
	submitAlteracao   inbound.SubmissaoUseCase
}

// NewHandlers injeta os ports de entrada e o construtor de cookies.
func NewHandlers(
	aceite inbound.AceiteUseCase,
	sessao inbound.SessaoUseCase,
	cookies *auth.CookieBuilder,
	rascunho inbound.RascunhoUseCase,
	upload inbound.DocumentoUseCase,
	submit inbound.SubmissaoUseCase,
	rascunhoAlteracao inbound.RascunhoUseCase,
	submitAlteracao inbound.SubmissaoUseCase,
) *Handlers {
	return &Handlers{
		aceite:            aceite,
		sessao:            sessao,
		cookies:           cookies,
		rascunho:          rascunho,
		upload:            upload,
		submit:            submit,
		rascunhoAlteracao: rascunhoAlteracao,
		submitAlteracao:   submitAlteracao,
	}
}

// valorOuPadrao devolve v, ou padrao se v estiver vazio. Usado para normalizar
// IP/User-Agent ausentes antes de chamar o serviço.
func valorOuPadrao(v, padrao string) string {
	if v == "" {
		return padrao
	}
	return v
}
