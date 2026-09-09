// Command worker consumirá a fila SQS de submissões para gerar o PDF e
// disparar o e-mail de notificação. A lógica fica em infrastructure.StartWorker.
//
// Batch 022: StartWorker é apenas um stub compilável que reserva o ponto de
// entrada do monorepo. A implementação real (loop SQS long-poll, geração de
// PDF, publicação no SNS, defesa em profundidade LGPD) pertence à spec 013.
package main

import (
	"fmt"
	"os"

	"github.com/tiagods/webtool/apps/api/infrastructure"
)

func main() {
	if err := infrastructure.StartWorker(); err != nil {
		fmt.Fprintln(os.Stderr, "fatal:", err)
		os.Exit(1)
	}
}
