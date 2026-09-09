package handler

import (
	"github.com/tiagods/webtool/apps/backend/domain/service"
	"github.com/tiagods/webtool/apps/backend/infrastructure/auth"
)

// Handlers agrupa os serviços de domínio e utilitários de transporte usados pelos
// handlers HTTP. Construído no ponto de composição (StartApp).
type Handlers struct {
	aceite            *service.AceiteService
	sessao            *service.SessaoService
	cookies           *auth.CookieBuilder
	rascunho          *service.RascunhoService
	upload            *service.UploadService
	submit            *service.SubmitService
	rascunhoAlteracao *service.AlteracaoRascunhoService
	submitAlteracao   *service.AlteracaoSubmitService
}

// NewHandlers injeta os serviços de domínio e o construtor de cookies.
func NewHandlers(
	aceite *service.AceiteService,
	sessao *service.SessaoService,
	cookies *auth.CookieBuilder,
	rascunho *service.RascunhoService,
	upload *service.UploadService,
	submit *service.SubmitService,
	rascunhoAlteracao *service.AlteracaoRascunhoService,
	submitAlteracao *service.AlteracaoSubmitService,
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
