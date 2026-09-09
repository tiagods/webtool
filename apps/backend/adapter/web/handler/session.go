package handler

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/tiagods/webtool/apps/backend/adapter/web/presenter"
	"github.com/tiagods/webtool/apps/backend/domain/entity"
	"github.com/tiagods/webtool/apps/backend/infrastructure/auth"
	"github.com/tiagods/webtool/apps/backend/infrastructure/middleware"
)

// PostSession cria (ou reaproveita) a sessão de abertura. Protegida por
// GuardAceite. Emite o cookie prolink_session apenas quando a sessão é nova.
func (h *Handlers) PostSession(c echo.Context) error {
	return h.criarSessao(c, entity.FormAbertura)
}

// PostAlteracaoSession é o equivalente para o formulário de alteração contratual
// (item inicial de rascunho na tabela de alteração).
func (h *Handlers) PostAlteracaoSession(c echo.Context) error {
	return h.criarSessao(c, entity.FormAlteracao)
}

func (h *Handlers) criarSessao(c echo.Context, formType entity.FormType) error {
	res, err := h.sessao.CriarOuObter(c.Request().Context(), formType, middleware.LerCookie(c, auth.CookieSessao))
	if err != nil {
		return err
	}
	if res.Nova {
		c.SetCookie(h.cookies.Sessao(res.Token))
	}
	return c.JSON(http.StatusOK, presenter.NewOK())
}

// DeleteSession executa a exclusão de dados sob solicitação (LGPD Art. 18). Não
// usa GuardSessao: precisa diferenciar sessão inexistente (403) de sessão já
// enviada (409).
func (h *Handlers) DeleteSession(c echo.Context) error {
	if err := h.sessao.EncerrarPorToken(c.Request().Context(), middleware.LerCookie(c, auth.CookieSessao)); err != nil {
		return err
	}
	c.SetCookie(h.cookies.ExpirarSessao())
	return c.JSON(http.StatusOK, presenter.NewOK())
}
