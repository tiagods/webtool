package infrastructure

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	awssdk "github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
	"github.com/aws/aws-sdk-go-v2/service/sqs/types"

	"github.com/tiagods/webtool/apps/backend/domain/entity"
	"github.com/tiagods/webtool/apps/backend/domain/service"
	infraaws "github.com/tiagods/webtool/apps/backend/infrastructure/aws"
	"github.com/tiagods/webtool/apps/backend/infrastructure/config"
	infraemail "github.com/tiagods/webtool/apps/backend/infrastructure/email"
)

// Intervalo entre polls do SQS (evita bater na API sem necessidade).
const workerPollDelay = 10 * time.Second

// StartWorker inicia o loop de consumo da fila SQS: carrega a configuração,
// monta os adapters e faz long-polling da fila, processando uma mensagem por
// vez. Aguarda SIGTERM para encerramento gracioso.
func StartWorker() error {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stderr, nil)))

	cfg, err := config.LoadFromEnv()
	if err != nil {
		return fmt.Errorf("carregar configuração: %w", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	clients, err := infraaws.NewClients(ctx, cfg.AWS)
	if err != nil {
		return fmt.Errorf("montar clients AWS: %w", err)
	}

	aberturaRepo := infraaws.NewDynamoRascunhoRepository(clients.Dynamo, cfg.AWS.DynamoAberturaTable)
	storage := infraaws.NewS3ObjectStorage(clients.S3, cfg.AWS.S3Bucket)
	mailer := infraemail.NewSMTPMailer(cfg.SMTP)

	notificar := service.NewNotificarSubmissao(aberturaRepo, storage, mailer, cfg.SMTP.To)

	slog.Info("worker iniciado",
		"queue", cfg.AWS.SQSQueueURL,
		"email_to", cfg.SMTP.To,
		"poll_delay", workerPollDelay.String(),
	)

	for {
		select {
		case <-ctx.Done():
			slog.Info("worker encerrando (SIGTERM recebido)")
			return nil
		default:
		}

		msg, err := receiveMessage(ctx, clients.SQS, cfg.AWS.SQSQueueURL)
		if err != nil {
			slog.Error("erro ao receber mensagem SQS", "err", err)
			sleep(ctx, workerPollDelay)
			continue
		}
		if msg == nil {
			sleep(ctx, workerPollDelay)
			continue
		}

		slog.Info("mensagem recebida",
			"receiptHandle", truncateReceipt(*msg.ReceiptHandle))

		var subMsg entity.SubmissaoMessage
		if err := json.Unmarshal([]byte(*msg.Body), &subMsg); err != nil {
			slog.Error("mensagem SQS inválida", "err", err)
			deleteMessage(ctx, clients.SQS, cfg.AWS.SQSQueueURL, *msg.ReceiptHandle)
			sleep(ctx, workerPollDelay)
			continue
		}

		if err := notificar.Processar(ctx, subMsg); err != nil {
			slog.Error("falha ao processar mensagem",
				"sessionId", subMsg.SessionID,
				"protocolo", subMsg.Protocolo,
				"err", err,
			)
			sleep(ctx, workerPollDelay)
			continue
		}

		if err := deleteMessage(ctx, clients.SQS, cfg.AWS.SQSQueueURL, *msg.ReceiptHandle); err != nil {
			slog.Error("erro ao deletar mensagem SQS", "err", err)
		}

		if err := aberturaRepo.MarcarEnviado(ctx, subMsg.SessionID, subMsg.Protocolo, subMsg.Tipo); err != nil {
			slog.Error("erro ao zerar dados sensíveis no DynamoDB",
				"sessionId", subMsg.SessionID,
				"err", err,
			)
		}

		slog.Info("mensagem processada com sucesso",
			"sessionId", subMsg.SessionID,
			"protocolo", subMsg.Protocolo,
			"formType", subMsg.FormType,
		)

		sleep(ctx, workerPollDelay)
	}
}

func receiveMessage(ctx context.Context, client *sqs.Client, queueURL string) (*types.Message, error) {
	out, err := client.ReceiveMessage(ctx, &sqs.ReceiveMessageInput{
		QueueUrl:            awssdk.String(queueURL),
		MaxNumberOfMessages: 1,
		WaitTimeSeconds:     20,
		VisibilityTimeout:   120,
	})
	if err != nil {
		return nil, fmt.Errorf("ReceiveMessage: %w", err)
	}
	if len(out.Messages) == 0 {
		return nil, nil
	}
	return &out.Messages[0], nil
}

func deleteMessage(ctx context.Context, client *sqs.Client, queueURL, receiptHandle string) error {
	_, err := client.DeleteMessage(ctx, &sqs.DeleteMessageInput{
		QueueUrl:      awssdk.String(queueURL),
		ReceiptHandle: awssdk.String(receiptHandle),
	})
	if err != nil {
		return fmt.Errorf("DeleteMessage: %w", err)
	}
	return nil
}

func sleep(ctx context.Context, d time.Duration) {
	select {
	case <-ctx.Done():
	case <-time.After(d):
	}
}

func truncateReceipt(r string) string {
	if len(r) > 40 {
		return r[:40] + "..."
	}
	return r
}
