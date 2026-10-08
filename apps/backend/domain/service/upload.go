package service

import (
	"context"
	"fmt"
	"time"

	"github.com/tiagods/webtool/apps/backend/domain/entity"
	"github.com/tiagods/webtool/apps/backend/domain/ports/inbound"
	"github.com/tiagods/webtool/apps/backend/domain/ports/outbound"
)

var _ inbound.DocumentoUseCase = (*UploadService)(nil)

// PresignUploadExpiraEm é a validade da URL PUT assinada devolvida por
// POST /api/upload-url.
const PresignUploadExpiraEm = 5 * time.Minute

// UploadService gera as URLs pré-assinadas de upload de documentos direto para o
// S3 (rota POST /api/upload-url) e confirma a gravação da key no rascunho. A
// criação/reaproveitamento da sessão é responsabilidade do SessaoService.
type UploadService struct {
	storage   outbound.DocumentoStorage
	rascunhos outbound.RascunhoRepository
	expiraEm  time.Duration
}

// NewUploadService injeta o storage de documentos, o repositório de rascunho
// (onde a key confirmada é gravada) e a validade das URLs assinadas
// (expiraEm <= 0 cai no padrão PresignUploadExpiraEm).
func NewUploadService(
	storage outbound.DocumentoStorage,
	rascunhos outbound.RascunhoRepository,
	expiraEm time.Duration,
) *UploadService {
	if expiraEm <= 0 {
		expiraEm = PresignUploadExpiraEm
	}
	return &UploadService{storage: storage, rascunhos: rascunhos, expiraEm: expiraEm}
}

// ValidarPedido checa campo e content-type sem tocar em I/O. O handler chama
// antes de criar a sessão, para um pedido malformado não deixar item órfão.
func (s *UploadService) ValidarPedido(campo, contentType string) error {
	if !entity.CampoDocumentoValido(campo) {
		return ErrCampoDocumentoInvalido
	}
	if !entity.ContentTypeDocumentoPermitido(contentType) {
		return ErrContentTypeDocumentoInvalido
	}
	return nil
}

// PresignarDocumento valida campo e content-type e devolve uma URL PUT assinada
// para "{sessionID}/documentos/{campo}.{ext}". A key não é devolvida ao cliente
// (contém o sessionID) — o cliente confirma o upload via POST /api/draft.
func (s *UploadService) PresignarDocumento(ctx context.Context, sessionID, campo, contentType string) (string, error) {
	if err := s.ValidarPedido(campo, contentType); err != nil {
		return "", err
	}

	key := entity.ChaveDocumento(sessionID, campo, contentType)
	url, err := s.storage.PresignedUploadURL(ctx, key, contentType, s.expiraEm)
	if err != nil {
		return "", fmt.Errorf("assinar URL de upload: %w", err)
	}
	return url, nil
}

// ConfirmarUpload registra a key S3 de um documento confirmado como enviado.
func (s *UploadService) ConfirmarUpload(ctx context.Context, sessionID, campo, contentType string) error {
	if !entity.CampoDocumentoValido(campo) {
		return ErrCampoDocumentoInvalido
	}
	if !entity.ContentTypeDocumentoPermitido(contentType) {
		return ErrContentTypeDocumentoInvalido
	}

	key := entity.ChaveDocumento(sessionID, campo, contentType)
	if err := s.rascunhos.PutDocumentoKey(ctx, sessionID, campo, key); err != nil {
		return fmt.Errorf("gravar key de documento: %w", err)
	}
	return nil
}
