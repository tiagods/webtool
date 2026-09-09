package service

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/tiagods/webtool/apps/backend/domain/entity"
)

func TestRascunhoService_Buscar(t *testing.T) {
	t.Parallel()

	repo := newFakeRascunhoRepo()
	repo.semeia(&entity.Rascunho{
		SessionID:      "s1",
		Status:         entity.StatusRascunho,
		Payload:        json.RawMessage(`{"dadosEmpresa":{"tipoConstituicao":"ltda"}}`),
		DocumentosKeys: map[string]string{"rg": "s1/documentos/rg.pdf"},
	})
	svc := NewRascunhoService(repo)

	r, err := svc.Buscar(context.Background(), "s1")
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if r == nil || string(r.Payload) != `{"dadosEmpresa":{"tipoConstituicao":"ltda"}}` {
		t.Errorf("payload = %v", r)
	}
	if r.DocumentosKeys["rg"] != "s1/documentos/rg.pdf" {
		t.Errorf("docs = %v", r.DocumentosKeys)
	}

	r, err = svc.Buscar(context.Background(), "inexistente")
	if err != nil || r != nil {
		t.Errorf("sessão inexistente: (%v, %v)", r, err)
	}
}

func TestRascunhoService_Salvar(t *testing.T) {
	t.Parallel()

	t.Run("payload parcial válido persiste e denormaliza o tipo", func(t *testing.T) {
		t.Parallel()
		repo := newFakeRascunhoRepo()
		svc := NewRascunhoService(repo)

		raw := json.RawMessage(`{"dadosEmpresa":{"tipoConstituicao":"slu","nomeEmpresarial1":"Aaa Bbb","nomeEmpresarial2":"Ccc Ddd","nomeEmpresarial3":"Eee Fff","atividade":"Consultoria empresarial e servicos"}}`)
		issues, err := svc.Salvar(context.Background(), "s1", raw)
		if err != nil || len(issues) > 0 {
			t.Fatalf("esperado sucesso, veio issues=%v err=%v", issues, err)
		}
		if repo.tipoGravado != entity.TipoSLU {
			t.Errorf("tipoGravado = %q, esperado slu", repo.tipoGravado)
		}
	})

	t.Run("chave de topo desconhecida → issues, sem gravar", func(t *testing.T) {
		t.Parallel()
		repo := newFakeRascunhoRepo()
		svc := NewRascunhoService(repo)

		issues, err := svc.Salvar(context.Background(), "s1", json.RawMessage(`{"foo":"bar"}`))
		if err != nil {
			t.Fatalf("erro inesperado: %v", err)
		}
		if len(issues) == 0 {
			t.Fatal("esperava issues para chave desconhecida")
		}
		if repo.payloadGravado != nil {
			t.Error("não deveria ter gravado payload inválido")
		}
	})

	t.Run("draft vazio é válido", func(t *testing.T) {
		t.Parallel()
		svc := NewRascunhoService(newFakeRascunhoRepo())
		issues, err := svc.Salvar(context.Background(), "s1", json.RawMessage(`{}`))
		if err != nil || len(issues) > 0 {
			t.Fatalf("draft vazio deveria passar: issues=%v err=%v", issues, err)
		}
	})

	t.Run("falha de infra vira erro", func(t *testing.T) {
		t.Parallel()
		repo := newFakeRascunhoRepo()
		repo.putPayloadErro = errors.New("dynamo fora do ar")
		svc := NewRascunhoService(repo)

		_, err := svc.Salvar(context.Background(), "s1", json.RawMessage(`{}`))
		if err == nil {
			t.Fatal("esperava erro de infra")
		}
	})
}

func TestRascunhoService_ConfirmarUpload(t *testing.T) {
	t.Parallel()

	t.Run("campo e content-type válidos gravam a key", func(t *testing.T) {
		t.Parallel()
		repo := newFakeRascunhoRepo()
		svc := NewRascunhoService(repo)

		if err := svc.ConfirmarUpload(context.Background(), "s1", "contrato_social", "application/pdf"); err != nil {
			t.Fatalf("erro inesperado: %v", err)
		}
		if got := repo.docsGravados["contrato_social"]; got != "s1/documentos/contrato_social.pdf" {
			t.Errorf("key gravada = %q", got)
		}
	})

	t.Run("campo inválido", func(t *testing.T) {
		t.Parallel()
		svc := NewRascunhoService(newFakeRascunhoRepo())
		err := svc.ConfirmarUpload(context.Background(), "s1", "Contrato Social", "application/pdf")
		if !errors.Is(err, ErrCampoDocumentoInvalido) {
			t.Errorf("err = %v, esperado ErrCampoDocumentoInvalido", err)
		}
	})

	t.Run("content-type não permitido", func(t *testing.T) {
		t.Parallel()
		svc := NewRascunhoService(newFakeRascunhoRepo())
		err := svc.ConfirmarUpload(context.Background(), "s1", "rg", "image/gif")
		if !errors.Is(err, ErrContentTypeDocumentoInvalido) {
			t.Errorf("err = %v, esperado ErrContentTypeDocumentoInvalido", err)
		}
	})
}
