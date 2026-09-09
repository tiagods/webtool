// Package model contém as projeções de persistência das entidades de domínio no
// DynamoDB: structs com tags `dynamodbav` e a conversão model → entity. Só os
// repositórios de infrastructure/aws devem importar este pacote — um model nunca
// cruza a fronteira de um port. O repositório recebe e devolve entity; na
// leitura, decodifica para um model e o converte antes de retornar.
package model

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/tiagods/webtool/apps/api/domain/entity"
)

// RascunhoItem é a projeção de persistência de entity.Rascunho. createdAt e
// updatedAt são ISO 8601 (mesmo formato do writer TypeScript de apps/api).
type RascunhoItem struct {
	SessionID      string            `dynamodbav:"sessionId"`
	Tipo           string            `dynamodbav:"tipo,omitempty"`
	Status         string            `dynamodbav:"status"`
	Protocolo      string            `dynamodbav:"protocolo,omitempty"`
	CreatedAt      string            `dynamodbav:"createdAt"`
	UpdatedAt      string            `dynamodbav:"updatedAt"`
	TTL            int64             `dynamodbav:"ttl"`
	DocumentosKeys map[string]string `dynamodbav:"documentosKeys"`
	Payload        map[string]any    `dynamodbav:"payload"`
}

// ToEntity converte a projeção de volta para o tipo de domínio.
func (it RascunhoItem) ToEntity() (*entity.Rascunho, error) {
	created, err := parseTempoOpcional(it.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("createdAt inválido: %w", err)
	}
	updated, err := parseTempoOpcional(it.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("updatedAt inválido: %w", err)
	}

	var payload json.RawMessage
	if it.Payload != nil {
		raw, err := json.Marshal(it.Payload)
		if err != nil {
			return nil, fmt.Errorf("serializar payload do rascunho: %w", err)
		}
		payload = raw
	}

	return &entity.Rascunho{
		SessionID:      it.SessionID,
		Tipo:           entity.TipoConstituicao(it.Tipo),
		Status:         entity.RascunhoStatus(it.Status),
		Protocolo:      it.Protocolo,
		CreatedAt:      created,
		UpdatedAt:      updated,
		TTL:            it.TTL,
		DocumentosKeys: it.DocumentosKeys,
		Payload:        payload,
	}, nil
}

// AceiteItem é a projeção de persistência de entity.RegistroAceite.
type AceiteItem struct {
	SessionID   string `dynamodbav:"sessionId"`
	VersaoTermo string `dynamodbav:"versaoTermo"`
	AceitoEm    string `dynamodbav:"aceitoEm"`
	IP          string `dynamodbav:"ip"`
	UserAgent   string `dynamodbav:"userAgent"`
	TTL         int64  `dynamodbav:"ttl"`
}

// AceiteItemFromEntity monta a projeção a partir do registro de domínio,
// derivando o atributo `ttl` (epoch-seconds) de AceitoEm + retencao. Erro se
// AceitoEm não for um instante RFC 3339 válido.
func AceiteItemFromEntity(reg entity.RegistroAceite, retencao time.Duration) (AceiteItem, error) {
	aceitoEm, err := time.Parse(time.RFC3339Nano, reg.AceitoEm)
	if err != nil {
		return AceiteItem{}, fmt.Errorf("interpretar data de aceite %q: %w", reg.AceitoEm, err)
	}
	return AceiteItem{
		SessionID:   reg.SessionID,
		VersaoTermo: reg.VersaoTermo,
		AceitoEm:    reg.AceitoEm,
		IP:          reg.IP,
		UserAgent:   reg.UserAgent,
		TTL:         aceitoEm.Add(retencao).Unix(),
	}, nil
}

func parseTempoOpcional(iso string) (time.Time, error) {
	if iso == "" {
		return time.Time{}, nil
	}
	return time.Parse(time.RFC3339Nano, iso)
}
