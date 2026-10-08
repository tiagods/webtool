// Package web monta o router HTTP da API (NewRouter): registra os middlewares
// base (infrastructure/middleware) e liga cada rota a um handler de
// adapter/web/handler. Os handlers e os middlewares ficam em pacotes próprios;
// aqui só vive a composição do roteamento.
package web

import (
	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"

	"github.com/tiagods/webtool/apps/backend/adapter/web/handler"
	"github.com/tiagods/webtool/apps/backend/domain/entity"
	"github.com/tiagods/webtool/apps/backend/domain/ports/inbound"
	"github.com/tiagods/webtool/apps/backend/domain/ports/outbound"
	"github.com/tiagods/webtool/apps/backend/infrastructure/auth"
	"github.com/tiagods/webtool/apps/backend/infrastructure/middleware"
)

// Deps reúne tudo que o router precisa, já montado no ponto de composição
// (infrastructure.StartApp). Os casos de uso entram pelos ports de entrada
// (domain/ports/inbound) — o adapter não conhece os services concretos.
type Deps struct {
	Aceite            inbound.AceiteUseCase
	Sessao            inbound.SessaoUseCase
	Rascunho          inbound.RascunhoUseCase
	Upload            inbound.DocumentoUseCase
	Submit            inbound.SubmissaoUseCase
	RascunhoAlteracao inbound.RascunhoUseCase
	SubmitAlteracao   inbound.SubmissaoUseCase
	Tokens            outbound.TokenService
	Cookies           *auth.CookieBuilder
	RateLimit         middleware.Limitador
}

// NewRouter constrói a instância Echo com os middlewares base e as rotas de
// auth/sessão + negócio (draft, upload-url, submit).
func NewRouter(d Deps) *echo.Echo {
	e := echo.New()
	e.HideBanner = true
	e.HidePort = true
	e.HTTPErrorHandler = middleware.HTTPErrorHandler

	e.Use(echomw.Recover())
	e.Use(middleware.RequestContext)

	e.GET("/health", handler.Health)

	h := handler.NewHandlers(d.Aceite, d.Sessao, d.Cookies, d.Rascunho, d.Upload, d.Submit,
		d.RascunhoAlteracao, d.SubmitAlteracao)

	// O rate limit (20 req/60s por IP) cobre toda a superfície /api.
	api := e.Group("/api", middleware.RateLimit(d.RateLimit))

	api.POST("/aceite-termo", h.PostAceiteTermo)
	api.DELETE("/session", h.DeleteSession)

	comAceite := api.Group("", middleware.GuardAceite(d.Sessao))
	comAceite.POST("/session", h.PostSession)
	comAceite.POST("/alteracao/session", h.PostAlteracaoSession)
	// upload-url não passa por GuardSessao: ele mesmo cria/reaproveita a sessão.
	comAceite.POST("/upload-url", h.PostUploadURL)

	comSessaoAbertura := comAceite.Group("", middleware.GuardSessao(d.Sessao, d.Tokens, entity.FormAbertura))
	comSessaoAbertura.GET("/draft", h.GetDraft)
	comSessaoAbertura.POST("/draft", h.PostDraft)
	comSessaoAbertura.POST("/submit", h.PostSubmit)

	comSessaoAlteracao := comAceite.Group("", middleware.GuardSessao(d.Sessao, d.Tokens, entity.FormAlteracao))
	comSessaoAlteracao.GET("/alteracao/draft", h.GetAlteracaoDraft)
	comSessaoAlteracao.POST("/alteracao/draft", h.PostAlteracaoDraft)
	comSessaoAlteracao.POST("/alteracao/submit", h.PostAlteracaoSubmit)

	return e
}
