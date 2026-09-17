// Command worker é o ponto de entrada do consumidor SQS: faz long-polling na
// fila de submissões, gera links presigned dos documentos, compõe o e-mail HTML
// com os dados da ficha e envia via SMTP. Implementado na spec 013.
package main

import (
	"fmt"
	"os"

	"github.com/tiagods/webtool/apps/backend/infrastructure"
)

func main() {
	if err := infrastructure.StartWorker(); err != nil {
		fmt.Fprintln(os.Stderr, "fatal:", err)
		os.Exit(1)
	}
}
