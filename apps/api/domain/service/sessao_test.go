package service

import (
	"context"
	"errors"
	"testing"

	"go.uber.org/mock/gomock"

	"github.com/tiagods/webtool/apps/api/domain/entity"
	"github.com/tiagods/webtool/apps/api/domain/ports/outbound/mocks"
)

func novaSessaoService(t *testing.T) (*SessaoService, *fakeRascunhoRepo, *fakeRascunhoRepo, *fakeTokens, *mocks.MockDocumentoStorage) {
	t.Helper()
	abertura := newFakeRascunhoRepo()
	alteracao := newFakeRascunhoRepo()
	tokens := newFakeTokens()
	storage := mocks.NewMockDocumentoStorage(gomock.NewController(t))
	return NewSessaoService(abertura, alteracao, tokens, storage), abertura, alteracao, tokens, storage
}

func TestSessaoService_VerificarAceite(t *testing.T) {
	t.Parallel()

	tests := []struct {
		nome    string
		token   string
		validos bool
		quer    error
	}{
		{"token vazio", "", true, ErrAceiteAusente},
		{"token inválido", "aceite:x:" + entity.TermoVersaoAtual, false, ErrAceiteAusente},
		{"versão antiga", "aceite:x:v0.1", true, ErrAceiteAusente},
		{"aceite válido", "aceite:x:" + entity.TermoVersaoAtual, true, nil},
	}

	for _, tt := range tests {
		t.Run(tt.nome, func(t *testing.T) {
			t.Parallel()
			svc, _, _, tokens, _ := novaSessaoService(t)
			tokens.validos = tt.validos

			err := svc.VerificarAceite(tt.token)
			if !errors.Is(err, tt.quer) {
				t.Fatalf("erro = %v, esperado %v", err, tt.quer)
			}
		})
	}
}

func TestSessaoService_CriarOuObter(t *testing.T) {
	t.Parallel()

	t.Run("sem cookie cria sessão nova e item de rascunho", func(t *testing.T) {
		t.Parallel()
		svc, abertura, _, _, _ := novaSessaoService(t)

		res, err := svc.CriarOuObter(context.Background(), entity.FormAbertura, "")
		if err != nil {
			t.Fatalf("erro inesperado: %v", err)
		}
		if !res.Nova || res.SessionID == "" || res.Token != "sessao:"+res.SessionID {
			t.Fatalf("resultado inesperado: %+v", res)
		}
		if _, ok := abertura.itens[res.SessionID]; !ok {
			t.Error("item inicial de rascunho não foi criado na tabela de abertura")
		}
	})

	t.Run("cookie válido reaproveita sessão sem novo token", func(t *testing.T) {
		t.Parallel()
		svc, abertura, _, _, _ := novaSessaoService(t)
		abertura.semeia(&entity.Rascunho{SessionID: "s1", Status: entity.StatusRascunho})

		res, err := svc.CriarOuObter(context.Background(), entity.FormAbertura, "sessao:s1")
		if err != nil {
			t.Fatalf("erro inesperado: %v", err)
		}
		if res.Nova || res.SessionID != "s1" || res.Token != "sessao:s1" {
			t.Fatalf("resultado inesperado: %+v", res)
		}
	})

	t.Run("cookie válido de outra tabela garante item na tabela do formType", func(t *testing.T) {
		t.Parallel()
		svc, abertura, alteracao, _, _ := novaSessaoService(t)
		abertura.semeia(&entity.Rascunho{SessionID: "s1", Status: entity.StatusRascunho})

		res, err := svc.CriarOuObter(context.Background(), entity.FormAlteracao, "sessao:s1")
		if err != nil {
			t.Fatalf("erro inesperado: %v", err)
		}
		if res.Nova {
			t.Error("sessão existente não deveria ser marcada como nova")
		}
		if _, ok := alteracao.itens["s1"]; !ok {
			t.Error("EnsureInicial não criou o item na tabela de alteração")
		}
	})

	t.Run("cookie inválido cria sessão nova", func(t *testing.T) {
		t.Parallel()
		svc, _, _, tokens, _ := novaSessaoService(t)
		tokens.validos = false

		res, err := svc.CriarOuObter(context.Background(), entity.FormAbertura, "sessao:lixo")
		if err != nil {
			t.Fatalf("erro inesperado: %v", err)
		}
		if !res.Nova {
			t.Error("esperava sessão nova para cookie inválido")
		}
	})
}

func TestSessaoService_RequireSessao(t *testing.T) {
	t.Parallel()

	tests := []struct {
		nome string
		item *entity.Rascunho
		quer error
	}{
		{"inexistente", nil, ErrSessaoInvalida},
		{"enviada", &entity.Rascunho{SessionID: "s1", Status: entity.StatusEnviado}, ErrSessaoEnviada},
		{"ativa", &entity.Rascunho{SessionID: "s1", Status: entity.StatusRascunho}, nil},
	}

	for _, tt := range tests {
		t.Run(tt.nome, func(t *testing.T) {
			t.Parallel()
			svc, abertura, _, _, _ := novaSessaoService(t)
			if tt.item != nil {
				abertura.semeia(tt.item)
			}

			err := svc.RequireSessao(context.Background(), entity.FormAbertura, "s1")
			if !errors.Is(err, tt.quer) {
				t.Fatalf("erro = %v, esperado %v", err, tt.quer)
			}
		})
	}
}

func TestSessaoService_Encerrar(t *testing.T) {
	t.Parallel()

	t.Run("sessão ativa limpa S3 e apaga o rascunho", func(t *testing.T) {
		t.Parallel()
		svc, abertura, _, _, storage := novaSessaoService(t)
		abertura.semeia(&entity.Rascunho{SessionID: "s1", Status: entity.StatusRascunho})
		storage.EXPECT().DeletePrefix(gomock.Any(), "s1/").Return(nil)

		if err := svc.Encerrar(context.Background(), "s1"); err != nil {
			t.Fatalf("erro inesperado: %v", err)
		}
		if _, ok := abertura.itens["s1"]; ok {
			t.Error("rascunho não foi apagado")
		}
	})

	t.Run("EncerrarPorToken: token vazio ou inválido → ErrSessaoInvalida", func(t *testing.T) {
		t.Parallel()
		svc, _, _, tokens, _ := novaSessaoService(t)

		if err := svc.EncerrarPorToken(context.Background(), ""); !errors.Is(err, ErrSessaoInvalida) {
			t.Fatalf("token vazio: erro = %v", err)
		}
		tokens.validos = false
		if err := svc.EncerrarPorToken(context.Background(), "sessao:s1"); !errors.Is(err, ErrSessaoInvalida) {
			t.Fatalf("token inválido: erro = %v", err)
		}
	})

	t.Run("EncerrarPorToken: token válido resolve e apaga", func(t *testing.T) {
		t.Parallel()
		svc, abertura, _, _, storage := novaSessaoService(t)
		abertura.semeia(&entity.Rascunho{SessionID: "s1", Status: entity.StatusRascunho})
		storage.EXPECT().DeletePrefix(gomock.Any(), "s1/").Return(nil)

		if err := svc.EncerrarPorToken(context.Background(), "sessao:s1"); err != nil {
			t.Fatalf("erro inesperado: %v", err)
		}
		if _, ok := abertura.itens["s1"]; ok {
			t.Error("rascunho não foi apagado")
		}
	})

	t.Run("sessão inexistente → ErrSessaoInvalida, sem tocar no S3", func(t *testing.T) {
		t.Parallel()
		svc, _, _, _, _ := novaSessaoService(t)
		// Sem EXPECT().DeletePrefix → o teste falha se o serviço tocar no S3.

		if err := svc.Encerrar(context.Background(), "s1"); !errors.Is(err, ErrSessaoInvalida) {
			t.Fatalf("erro = %v, esperado ErrSessaoInvalida", err)
		}
	})

	t.Run("sessão enviada → ErrSessaoEnviada, sem tocar no S3", func(t *testing.T) {
		t.Parallel()
		svc, abertura, _, _, _ := novaSessaoService(t)
		abertura.semeia(&entity.Rascunho{SessionID: "s1", Status: entity.StatusEnviado})
		// Sem EXPECT().DeletePrefix → o teste falha se o serviço tocar no S3.

		if err := svc.Encerrar(context.Background(), "s1"); !errors.Is(err, ErrSessaoEnviada) {
			t.Fatalf("erro = %v, esperado ErrSessaoEnviada", err)
		}
	})
}
