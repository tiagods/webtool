// Package infrastructure hospeda o ponto de composição da aplicação
// (StartApp / StartWorker): lê a configuração, monta os adapters, injeta nos
// serviços, monta o router e cuida do ciclo de vida do processo.
package infrastructure

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/tiagods/webtool/apps/backend/adapter/web"
	"github.com/tiagods/webtool/apps/backend/domain/service"
	"github.com/tiagods/webtool/apps/backend/infrastructure/auth"
	infraaws "github.com/tiagods/webtool/apps/backend/infrastructure/aws"
	"github.com/tiagods/webtool/apps/backend/infrastructure/config"
	"github.com/tiagods/webtool/apps/backend/infrastructure/ratelimit"
)

// StartApp sobe o servidor HTTP da API: carrega a configuração (falha rápido se
// faltar variável obrigatória), registra o handler de log estruturado, monta o
// router e bloqueia até um sinal de término, encerrando de forma graciosa.
func StartApp() error {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stderr, nil)))

	cfg, err := config.LoadFromEnv()
	if err != nil {
		return fmt.Errorf("carregar configuração: %w", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	deps, err := montarDeps(ctx, cfg)
	if err != nil {
		return err
	}

	e := web.NewRouter(deps)

	serverErr := make(chan error, 1)
	go func() {
		serverErr <- e.Start(fmt.Sprintf(":%d", cfg.Port))
	}()

	select {
	case err := <-serverErr:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return fmt.Errorf("servidor HTTP: %w", err)
	case <-ctx.Done():
		return shutdown(e, cfg.ShutdownTimeout)
	}
}

// montarDeps é o wiring da camada de auth/sessão: clients AWS → adapters →
// serviço de token/cookies → serviços de domínio → rate limiter.
func montarDeps(ctx context.Context, cfg config.Config) (web.Deps, error) {
	clients, err := infraaws.NewClients(ctx, cfg.AWS)
	if err != nil {
		return web.Deps{}, fmt.Errorf("montar clients AWS: %w", err)
	}

	aberturaRepo := infraaws.NewDynamoRascunhoRepository(clients.Dynamo, cfg.AWS.DynamoAberturaTable)
	alteracaoRepo := infraaws.NewDynamoRascunhoRepository(clients.Dynamo, cfg.AWS.DynamoAlteracaoTable)
	aceiteRepo := infraaws.NewDynamoAceiteRepository(clients.Dynamo, cfg.AWS.DynamoAceitesTable)
	storage := infraaws.NewS3ObjectStorage(clients.S3, cfg.AWS.S3Bucket)

	// Cada formulário tem seu contador de protocolo na própria tabela (item
	// COUNTER); a fila é única para os dois.
	aberturaProtocolo := infraaws.NewDynamoProtocoloCounter(clients.Dynamo, cfg.AWS.DynamoAberturaTable)
	alteracaoProtocolo := infraaws.NewDynamoProtocoloCounter(clients.Dynamo, cfg.AWS.DynamoAlteracaoTable)
	submissoes := infraaws.NewSQSSubmissaoPublisher(clients.SQS, cfg.AWS.SQSQueueURL)

	tokens := auth.NewJWTTokenService(cfg.JWTSecret, cfg.SessionExpiry)

	return web.Deps{
		Aceite:            service.NewAceiteService(aceiteRepo, tokens),
		Sessao:            service.NewSessaoService(aberturaRepo, alteracaoRepo, tokens, storage),
		Rascunho:          service.NewRascunhoService(aberturaRepo),
		Upload:            service.NewUploadService(storage, service.PresignUploadExpiraEm),
		Submit:            service.NewSubmitService(aberturaRepo, aberturaProtocolo, submissoes, storage),
		RascunhoAlteracao: service.NewAlteracaoRascunhoService(alteracaoRepo),
		SubmitAlteracao:   service.NewAlteracaoSubmitService(alteracaoProtocolo, storage, submissoes, alteracaoRepo),
		Tokens:            tokens,
		Cookies:           auth.NewCookieBuilder(cfg.IsProd(), cfg.SessionExpiry),
		RateLimit:         ratelimit.NewFixedWindow(ratelimit.PadraoLimite, ratelimit.PadraoJanela),
	}, nil
}

// shutdown encerra o servidor Echo de forma graciosa, respeitando o timeout
// configurado para as conexões em andamento.
func shutdown(e *echo.Echo, timeout time.Duration) error {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	if err := e.Shutdown(ctx); err != nil {
		return fmt.Errorf("shutdown gracioso: %w", err)
	}
	return nil
}
