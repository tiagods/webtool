package service

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/tiagods/webtool/apps/backend/domain/entity"
	"github.com/tiagods/webtool/apps/backend/domain/ports/outbound"
	"github.com/tiagods/webtool/apps/backend/domain/validation"
)

// RascunhoService cobre as operações de rascunho da Ficha de Abertura ligadas às
// rotas GET/POST /api/draft: leitura do rascunho, gravação do payload parcial
// validado e confirmação de upload de documento. Opera sobre o repositório da
// tabela de abertura.
type RascunhoService struct {
	repo outbound.RascunhoRepository
}

// NewRascunhoService injeta o repositório de rascunho (tabela de abertura).
func NewRascunhoService(repo outbound.RascunhoRepository) *RascunhoService {
	return &RascunhoService{repo: repo}
}

// Buscar devolve o rascunho salvo da sessão, ou nil se ainda não houver item —
// o guard de sessão já garantiu que a sessão é válida; um rascunho recém-criado
// tem payload/documentosKeys vazios. O handler projeta o resultado no presenter.
func (s *RascunhoService) Buscar(ctx context.Context, sessionID string) (*entity.Rascunho, error) {
	item, err := s.repo.Get(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("buscar rascunho: %w", err)
	}
	return item, nil
}

// Salvar valida o rascunho parcial (aberturaFormDraftSchema) e persiste o
// payload, renovando o TTL. As issues de validação são devolvidas para o handler
// responder 400 com elas no corpo; o erro só sinaliza falha de infraestrutura.
func (s *RascunhoService) Salvar(ctx context.Context, sessionID string, raw json.RawMessage) ([]validation.Issue, error) {
	if issues := validation.ValidarAberturaDraft(raw); len(issues) > 0 {
		return issues, nil
	}

	if err := s.repo.PutPayload(ctx, sessionID, raw, extrairTipoConstituicao(raw)); err != nil {
		return nil, fmt.Errorf("gravar rascunho: %w", err)
	}
	return nil, nil
}

// ConfirmarUpload registra a key S3 de um documento confirmado como enviado.
func (s *RascunhoService) ConfirmarUpload(ctx context.Context, sessionID, campo, contentType string) error {
	if !entity.CampoDocumentoValido(campo) {
		return ErrCampoDocumentoInvalido
	}
	if !entity.ContentTypeDocumentoPermitido(contentType) {
		return ErrContentTypeDocumentoInvalido
	}

	key := entity.ChaveDocumento(sessionID, campo, contentType)
	if err := s.repo.PutDocumentoKey(ctx, sessionID, campo, key); err != nil {
		return fmt.Errorf("gravar key de documento: %w", err)
	}
	return nil
}

// extrairTipoConstituicao lê dadosEmpresa.tipoConstituicao do payload para
// denormalizar `tipo` no item (usado pelo worker). Ausente/inválido ⇒ "" (o
// repositório deixa o campo intacto).
func extrairTipoConstituicao(raw json.RawMessage) entity.TipoConstituicao {
	var envelope struct {
		DadosEmpresa struct {
			TipoConstituicao string `json:"tipoConstituicao"`
		} `json:"dadosEmpresa"`
	}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return ""
	}
	tipo := entity.TipoConstituicao(envelope.DadosEmpresa.TipoConstituicao)
	if !tipo.Valido() {
		return ""
	}
	return tipo
}
