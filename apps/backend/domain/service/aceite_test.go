package service

import (
	"context"
	"errors"
	"testing"

	"go.uber.org/mock/gomock"

	"github.com/tiagods/webtool/apps/backend/domain/entity"
	"github.com/tiagods/webtool/apps/backend/domain/ports/outbound/mocks"
)

func TestAceiteService_RegistrarAceite(t *testing.T) {
	t.Parallel()

	t.Run("versão inválida não persiste nem assina", func(t *testing.T) {
		t.Parallel()
		repo := mocks.NewMockAceiteRepository(gomock.NewController(t))
		svc := NewAceiteService(repo, newFakeTokens())
		// Sem EXPECT().Put → o teste falha se o serviço tentar persistir.

		_, err := svc.RegistrarAceite(context.Background(), "v0.9", "1.2.3.4", "agent")
		if !errors.Is(err, ErrVersaoTermoInvalida) {
			t.Fatalf("erro = %v, esperado ErrVersaoTermoInvalida", err)
		}
	})

	t.Run("versão vigente persiste registro e devolve token", func(t *testing.T) {
		t.Parallel()
		repo := mocks.NewMockAceiteRepository(gomock.NewController(t))
		svc := NewAceiteService(repo, newFakeTokens())

		var gravado entity.RegistroAceite
		repo.EXPECT().Put(gomock.Any(), gomock.Any()).DoAndReturn(
			func(_ context.Context, r entity.RegistroAceite) error {
				gravado = r
				return nil
			})

		token, err := svc.RegistrarAceite(context.Background(), entity.TermoVersaoAtual, "1.2.3.4", "agent")
		if err != nil {
			t.Fatalf("erro inesperado: %v", err)
		}
		if gravado.SessionID == "" {
			t.Error("SessionID não foi gerado")
		}
		if gravado.VersaoTermo != entity.TermoVersaoAtual {
			t.Errorf("VersaoTermo = %q", gravado.VersaoTermo)
		}
		if gravado.AceitoEm == "" {
			t.Error("AceitoEm vazio")
		}
		if gravado.IP != "1.2.3.4" || gravado.UserAgent != "agent" {
			t.Errorf("IP/UserAgent não propagados: %+v", gravado)
		}
		if token != "aceite:"+gravado.SessionID+":"+entity.TermoVersaoAtual {
			t.Errorf("token inesperado: %q", token)
		}
	})

	t.Run("falha do repositório não assina token", func(t *testing.T) {
		t.Parallel()
		repo := mocks.NewMockAceiteRepository(gomock.NewController(t))
		svc := NewAceiteService(repo, newFakeTokens())

		repo.EXPECT().Put(gomock.Any(), gomock.Any()).Return(errors.New("dynamo fora do ar"))

		if _, err := svc.RegistrarAceite(context.Background(), entity.TermoVersaoAtual, "", ""); err == nil {
			t.Fatal("esperava erro do repositório")
		}
	})
}
