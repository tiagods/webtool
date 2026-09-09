// Package logger é uma fachada fina sobre log/slog que anexa o correlation id
// da requisição a cada registro. A configuração do handler (destino, formato)
// é responsabilidade do ponto de composição (cmd/*), via slog.SetDefault.
package logger

import (
	"context"
	"log/slog"

	"github.com/tiagods/webtool/apps/backend/infrastructure/requestcontext"
)

// forContext devolve o logger padrão enriquecido com o cid de ctx, quando houver.
func forContext(ctx context.Context) *slog.Logger {
	l := slog.Default()
	if cid := requestcontext.CID(ctx); cid != "" {
		l = l.With(slog.String("cid", cid))
	}
	return l
}

// Warn registra um evento de nível WARN (ex.: requisição rejeitada por regra de negócio).
func Warn(ctx context.Context, err error, msg string) {
	forContext(ctx).WarnContext(ctx, msg, slog.Any("error", err))
}

// Error registra um evento de nível ERROR (ex.: falha inesperada de dependência).
func Error(ctx context.Context, err error, msg string) {
	forContext(ctx).ErrorContext(ctx, msg, slog.Any("error", err))
}
