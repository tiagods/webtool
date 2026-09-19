// Command api é o servidor HTTP. Toda a composição vive em
// infrastructure.StartApp, mantendo este main sem lógica além do exit code.
package main

import (
	"fmt"
	"os"

	"github.com/tiagods/webtool/apps/backend/infrastructure"
)

func main() {
	if err := infrastructure.StartApp(); err != nil {
		fmt.Fprintln(os.Stderr, "fatal:", err)
		os.Exit(1)
	}
}
