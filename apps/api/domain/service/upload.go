package service

import (
	"context"
	"fmt"
	"time"

	"github.com/tiagods/webtool/apps/api/domain/entity"
	"github.com/tiagods/webtool/apps/api/domain/ports/outbound"
)

// PresignUploadExpiraEm é a validade da URL PUT assinada devolvida por
// POST /api/upload-url. Espelha o `expiresIn = 300` de apps/api/lib/aws/s3.ts.
const PresignUploadExpiraEm = 5 * time.Minute

// UploadService gera as URLs pré-assinadas de upload de documentos direto para o
// S3 (rota POST /api/upload-url). A criação/reaproveitamento da sessão é
// responsabilidade do SessaoService; aqui só entra a assinatura da URL.
type UploadService struct {
	storage  outbound.DocumentoStorage
	expiraEm time.Duration
}

// NewUploadService injeta o storage de documentos e a validade das URLs
// assinadas (expiraEm <= 0 cai no padrão PresignUploadExpiraEm).
func NewUploadService(storage outbound.DocumentoStorage, expiraEm time.Duration) *UploadService {
	if expiraEm <= 0 {
		expiraEm = PresignUploadExpiraEm
	}
	return &UploadService{storage: storage, expiraEm: expiraEm}
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
