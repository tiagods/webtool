package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"go.uber.org/mock/gomock"

	"github.com/tiagods/webtool/apps/backend/domain/ports/outbound/mocks"
)

func TestUploadService_PresignarDocumento(t *testing.T) {
	t.Parallel()

	t.Run("gera URL para a key da sessão com a validade configurada", func(t *testing.T) {
		t.Parallel()
		storage := mocks.NewMockDocumentoStorage(gomock.NewController(t))
		storage.EXPECT().
			PresignedUploadURL(gomock.Any(), "s1/documentos/rg.png", "image/png", PresignUploadExpiraEm).
			Return("https://s3.local/s1/documentos/rg.png", nil)
		svc := NewUploadService(storage, newFakeRascunhoRepo(), 0) // 0 → padrão

		url, err := svc.PresignarDocumento(context.Background(), "s1", "rg", "image/png")
		if err != nil {
			t.Fatalf("erro inesperado: %v", err)
		}
		if url != "https://s3.local/s1/documentos/rg.png" {
			t.Errorf("url = %q", url)
		}
	})

	t.Run("validade customizada é repassada", func(t *testing.T) {
		t.Parallel()
		storage := mocks.NewMockDocumentoStorage(gomock.NewController(t))
		storage.EXPECT().
			PresignedUploadURL(gomock.Any(), gomock.Any(), gomock.Any(), 90*time.Second).
			Return("https://s3.local/x", nil)
		svc := NewUploadService(storage, newFakeRascunhoRepo(), 90*time.Second)

		if _, err := svc.PresignarDocumento(context.Background(), "s1", "rg", "application/pdf"); err != nil {
			t.Fatalf("erro inesperado: %v", err)
		}
	})

	t.Run("campo inválido não chama o storage", func(t *testing.T) {
		t.Parallel()
		storage := mocks.NewMockDocumentoStorage(gomock.NewController(t))
		// Sem EXPECT → o teste falha se PresignedUploadURL for chamado.
		svc := NewUploadService(storage, newFakeRascunhoRepo(), 0)

		_, err := svc.PresignarDocumento(context.Background(), "s1", "rg-frente", "application/pdf")
		if !errors.Is(err, ErrCampoDocumentoInvalido) {
			t.Errorf("err = %v, esperado ErrCampoDocumentoInvalido", err)
		}
	})

	t.Run("content-type não permitido", func(t *testing.T) {
		t.Parallel()
		storage := mocks.NewMockDocumentoStorage(gomock.NewController(t))
		svc := NewUploadService(storage, newFakeRascunhoRepo(), 0)
		_, err := svc.PresignarDocumento(context.Background(), "s1", "rg", "text/plain")
		if !errors.Is(err, ErrContentTypeDocumentoInvalido) {
			t.Errorf("err = %v, esperado ErrContentTypeDocumentoInvalido", err)
		}
	})

	t.Run("erro do storage é embrulhado", func(t *testing.T) {
		t.Parallel()
		storage := mocks.NewMockDocumentoStorage(gomock.NewController(t))
		storage.EXPECT().
			PresignedUploadURL(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).
			Return("", errors.New("s3 fora do ar"))
		svc := NewUploadService(storage, newFakeRascunhoRepo(), 0)

		_, err := svc.PresignarDocumento(context.Background(), "s1", "rg", "application/pdf")
		if err == nil || errors.Is(err, ErrCampoDocumentoInvalido) {
			t.Errorf("esperava erro de infra embrulhado, veio %v", err)
		}
	})
}

func TestUploadService_ConfirmarUpload(t *testing.T) {
	t.Parallel()

	t.Run("campo e content-type válidos gravam a key", func(t *testing.T) {
		t.Parallel()
		storage := mocks.NewMockDocumentoStorage(gomock.NewController(t))
		repo := newFakeRascunhoRepo()
		svc := NewUploadService(storage, repo, 0)

		if err := svc.ConfirmarUpload(context.Background(), "s1", "contrato_social", "application/pdf"); err != nil {
			t.Fatalf("erro inesperado: %v", err)
		}
		if got := repo.docsGravados["contrato_social"]; got != "s1/documentos/contrato_social.pdf" {
			t.Errorf("key gravada = %q", got)
		}
	})

	t.Run("campo inválido não grava a key", func(t *testing.T) {
		t.Parallel()
		storage := mocks.NewMockDocumentoStorage(gomock.NewController(t))
		repo := newFakeRascunhoRepo()
		svc := NewUploadService(storage, repo, 0)

		err := svc.ConfirmarUpload(context.Background(), "s1", "Contrato Social", "application/pdf")
		if !errors.Is(err, ErrCampoDocumentoInvalido) {
			t.Errorf("err = %v, esperado ErrCampoDocumentoInvalido", err)
		}
		if len(repo.docsGravados) != 0 {
			t.Errorf("não deveria ter gravado key: %v", repo.docsGravados)
		}
	})

	t.Run("content-type não permitido", func(t *testing.T) {
		t.Parallel()
		storage := mocks.NewMockDocumentoStorage(gomock.NewController(t))
		svc := NewUploadService(storage, newFakeRascunhoRepo(), 0)
		err := svc.ConfirmarUpload(context.Background(), "s1", "rg", "image/gif")
		if !errors.Is(err, ErrContentTypeDocumentoInvalido) {
			t.Errorf("err = %v, esperado ErrContentTypeDocumentoInvalido", err)
		}
	})
}
