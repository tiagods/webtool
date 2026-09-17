package service

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/tiagods/webtool/apps/backend/domain/entity"
	"github.com/tiagods/webtool/apps/backend/domain/ports/outbound"
	"github.com/tiagods/webtool/apps/backend/domain/validation"
)

// AlteracaoSubmitService finaliza a Ficha de Alteração (rota POST
// /api/alteracao/submit).
type AlteracaoSubmitService struct {
	protocolo outbound.ProtocoloCounter
	storage   outbound.DocumentoStorage
	publisher outbound.SubmissaoPublisher
	repo      outbound.RascunhoRepository
}

// NewAlteracaoSubmitService injeta os ports do submit da alteração: contador de
// protocolo e repositório da tabela de alteração, storage de objetos e publisher
// da fila.
func NewAlteracaoSubmitService(
	protocolo outbound.ProtocoloCounter,
	storage outbound.DocumentoStorage,
	publisher outbound.SubmissaoPublisher,
	repo outbound.RascunhoRepository,
) *AlteracaoSubmitService {
	return &AlteracaoSubmitService{protocolo: protocolo, storage: storage, publisher: publisher, repo: repo}
}

// Submeter valida o payload completo e, se válido, finaliza a ficha. As issues
// de validação voltam para o handler responder 400; err sinaliza só falha de
// infraestrutura (→ 500) e aborta a finalização.
func (s *AlteracaoSubmitService) Submeter(ctx context.Context, sessionID string, raw json.RawMessage) (string, []validation.Issue, error) {
	if issues := validation.ValidarAlteracaoForm(raw); len(issues) > 0 {
		return "", issues, nil
	}

	tipo := extrairTipoConstituicaoAlteracao(raw)

	protocolo, err := s.protocolo.Proximo(ctx, entity.ProtocoloPrefixAlteracao)
	if err != nil {
		return "", nil, fmt.Errorf("gerar protocolo: %w", err)
	}

	// Backup: o próprio payload validado (sem arquivos neste formulário). raw já
	// passou pela validação completa; PutJSON o grava verbatim (json.RawMessage).
	chave := "protocolos/" + protocolo + "/alteracao.json"
	if err := s.storage.PutJSON(ctx, chave, raw); err != nil {
		return "", nil, fmt.Errorf("gravar backup do payload: %w", err)
	}

	msg := entity.SubmissaoMessage{
		SessionID: sessionID,
		Protocolo: protocolo,
		FormType:  entity.FormAlteracao,
		Tipo:      tipo,
	}
	if err := s.publisher.Publish(ctx, msg); err != nil {
		return "", nil, fmt.Errorf("publicar submissão: %w", err)
	}

	// MarcarEnviado antes de o handler expirar o cookie fecha a janela de reuso
	// de um JWT de sessão ainda válido.
	if err := s.repo.MarcarEnviado(ctx, sessionID, protocolo, tipo); err != nil {
		return "", nil, fmt.Errorf("marcar sessão enviada: %w", err)
	}

	return protocolo, nil, nil
}
