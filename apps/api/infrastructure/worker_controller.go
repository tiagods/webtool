package infrastructure

import (
	"log/slog"
	"os"
)

// StartWorker vai consumir a fila SQS de submissões para gerar o PDF e disparar
// o e-mail de notificação.
//
// Batch 022: stub compilável — reserva o ponto de entrada. O loop SQS long-poll,
// a geração de PDF, a publicação no SNS e a defesa em profundidade LGPD são
// escopo da spec 013.
func StartWorker() error {
	slog.New(slog.NewJSONHandler(os.Stderr, nil)).
		Info("worker não implementado — ver spec 013 (worker PDF + e-mail)")
	return nil
}
