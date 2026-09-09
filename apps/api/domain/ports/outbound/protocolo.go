package outbound

import "context"

// ProtocoloCounter gera protocolos sequenciais no formato
// {prefix}{ano UTC}-{seq 6 dígitos} via um contador atômico por tabela.
type ProtocoloCounter interface {
	// Proximo incrementa o contador e devolve o protocolo formatado.
	Proximo(ctx context.Context, prefix string) (string, error)
}
