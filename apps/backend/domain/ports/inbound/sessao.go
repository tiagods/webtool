package inbound

import (
	"context"

	"github.com/tiagods/webtool/apps/backend/domain/entity"
)

// SessaoResult descreve o desfecho de SessaoUseCase.CriarOuObter. Token só
// precisa ser gravado no cookie quando Nova é true (o cookie existente
// continua válido caso contrário).
type SessaoResult struct {
	SessionID string
	Token     string
	Nova      bool
}

// SessaoUseCase orquestra a autenticação por cookie: valida o aceite do
// termo, cria ou reaproveita a sessão (JWT + item inicial de rascunho) e
// encerra a sessão sob solicitação.
type SessaoUseCase interface {
	// VerificarAceite falha com ErrAceiteAusente se o token do cookie
	// prolink_aceite estiver ausente, for inválido/expirado ou trouxer uma
	// versão de termo antiga.
	VerificarAceite(aceiteToken string) error

	// CriarOuObter reaproveita o cookie prolink_session quando válido ou
	// cria uma sessão nova (UUID + token), garantindo o item inicial de
	// rascunho na tabela do formType.
	CriarOuObter(ctx context.Context, formType entity.FormType, sessaoToken string) (SessaoResult, error)

	// RequireSessao valida que a sessão existe na tabela do formType e ainda
	// não foi enviada.
	RequireSessao(ctx context.Context, formType entity.FormType, sessionID string) error

	// EncerrarPorToken resolve o sessionID a partir do token do cookie
	// prolink_session e delega para Encerrar.
	EncerrarPorToken(ctx context.Context, sessaoToken string) error

	// Encerrar apaga os dados da sessão (exclusão sob solicitação, LGPD
	// Art. 18): objetos S3 sob a pasta da sessão e o item de rascunho.
	Encerrar(ctx context.Context, sessionID string) error
}
