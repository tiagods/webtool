package service

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/tiagods/webtool/apps/backend/domain/entity"
	"github.com/tiagods/webtool/apps/backend/domain/ports/outbound"
	"github.com/tiagods/webtool/apps/backend/domain/validation"
)

// AlteracaoRascunhoService cobre as rotas GET/POST /api/alteracao/draft: leitura
// do rascunho e gravação do payload parcial validado. Opera sobre o repositório
// da tabela de alteração. Diferente da Abertura, o formulário de Alteração não
// tem upload de documentos — não há ConfirmarUpload.
type AlteracaoRascunhoService struct {
	repo outbound.RascunhoRepository
}

// NewAlteracaoRascunhoService injeta o repositório de rascunho (tabela de alteração).
func NewAlteracaoRascunhoService(repo outbound.RascunhoRepository) *AlteracaoRascunhoService {
	return &AlteracaoRascunhoService{repo: repo}
}

// Buscar devolve o rascunho salvo da sessão, ou nil se ainda não houver item.
func (s *AlteracaoRascunhoService) Buscar(ctx context.Context, sessionID string) (*entity.Rascunho, error) {
	item, err := s.repo.Get(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("buscar rascunho: %w", err)
	}
	return item, nil
}

// Salvar valida o rascunho parcial (alteracaoFormDraftSchema) e persiste o
// payload, renovando o TTL. As issues de validação são devolvidas para o handler
// responder 400 com elas no corpo; o erro só sinaliza falha de infraestrutura.
func (s *AlteracaoRascunhoService) Salvar(ctx context.Context, sessionID string, raw json.RawMessage) ([]validation.Issue, error) {
	if issues := validation.ValidarAlteracaoDraft(raw); len(issues) > 0 {
		return issues, nil
	}

	if err := s.repo.PutPayload(ctx, sessionID, raw, extrairTipoConstituicaoAlteracao(raw)); err != nil {
		return nil, fmt.Errorf("gravar rascunho: %w", err)
	}
	return nil, nil
}

// extrairTipoConstituicaoAlteracao lê identificacao.tipoConstituicao do payload
// para denormalizar `tipo` no item (usado pelo worker). Ausente/inválido ⇒ "" (o
// repositório deixa o campo intacto). Espelha a lógica de putRascunho no Node.
func extrairTipoConstituicaoAlteracao(raw json.RawMessage) entity.TipoConstituicao {
	var envelope struct {
		Identificacao struct {
			TipoConstituicao string `json:"tipoConstituicao"`
		} `json:"identificacao"`
	}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return ""
	}
	tipo := entity.TipoConstituicao(envelope.Identificacao.TipoConstituicao)
	if !tipo.Valido() {
		return ""
	}
	return tipo
}
