package entity

import (
	"encoding/json"
	"time"
)

// Rascunho é o item persistido de uma sessão de preenchimento de formulário.
// Payload e DocumentosKeys ficam nulos enquanto ausentes e são zerados no envio
// (defesa em profundidade LGPD — ver RascunhoRepository.MarcarEnviado).
type Rascunho struct {
	SessionID string
	Tipo      TipoConstituicao
	Status    RascunhoStatus
	Protocolo string
	CreatedAt time.Time
	UpdatedAt time.Time
	// TTL é o instante de expiração no formato epoch-seconds esperado pelo
	// atributo `ttl` do DynamoDB (2h em rascunho, 30d após envio).
	TTL            int64
	DocumentosKeys map[string]string
	Payload        json.RawMessage
}

// Enviado informa se o rascunho já teve o submit concluído.
func (r Rascunho) Enviado() bool {
	return r.Status == StatusEnviado
}
