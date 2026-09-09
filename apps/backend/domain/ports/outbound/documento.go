package outbound

import (
	"context"
	"time"
)

// DocumentoStorage cobre as operações sobre o bucket de documentos: presign de
// upload, gravação direta de JSON, cópia para a pasta do protocolo e limpeza da
// pasta da sessão após o submit.
type DocumentoStorage interface {
	// PresignedUploadURL devolve uma URL PUT assinada, válida por expiresIn, já
	// com a tag de retenção de rascunho aplicada ao objeto.
	PresignedUploadURL(ctx context.Context, key, contentType string, expiresIn time.Duration) (string, error)

	// PutJSON grava data serializado como application/json na key indicada.
	PutJSON(ctx context.Context, key string, data any) error

	// Copy copia srcKey para destKey removendo as tags do objeto de destino
	// (ele deixa de ser alcançável pela Lifecycle Rule de expiração).
	Copy(ctx context.Context, srcKey, destKey string) error

	// DeletePrefix apaga todos os objetos sob prefix (assume < 1000 objetos).
	DeletePrefix(ctx context.Context, prefix string) error
}
