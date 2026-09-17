// Command worker é o ponto de entrada do consumidor SQS que notifica as fichas
// submetidas por e-mail. A composição vive em infrastructure.StartWorker.
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
