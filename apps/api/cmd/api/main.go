// Command api é o servidor HTTP que substitui o apps/api Node (spec 022+).
// A composição (config, adapters, router, ciclo de vida) fica em
// infrastructure.StartApp — este main só a invoca e traduz o erro em exit code.
package main

import (
	"fmt"
	"os"

	"github.com/tiagods/webtool/apps/api/infrastructure"
)

func main() {
	if err := infrastructure.StartApp(); err != nil {
		fmt.Fprintln(os.Stderr, "fatal:", err)
		os.Exit(1)
	}
}
