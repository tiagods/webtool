package service

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/tiagods/webtool/apps/backend/domain/entity"
)

func TestAlteracaoRascunhoService_Buscar(t *testing.T) {
	t.Parallel()

	repo := newFakeRascunhoRepo()
	repo.semeia(&entity.Rascunho{
		SessionID: "s1",
		Status:    entity.StatusRascunho,
		Payload:   json.RawMessage(`{"quadros":["objeto_social"]}`),
	})
	svc := NewAlteracaoRascunhoService(repo)

	r, err := svc.Buscar(context.Background(), "s1")
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if r == nil || string(r.Payload) != `{"quadros":["objeto_social"]}` {
		t.Errorf("payload = %v", r)
	}

	r, err = svc.Buscar(context.Background(), "inexistente")
	if err != nil || r != nil {
		t.Errorf("sessão inexistente: (%v, %v)", r, err)
	}
}

func TestAlteracaoRascunhoService_Salvar(t *testing.T) {
	t.Parallel()

	t.Run("payload parcial válido persiste e denormaliza o tipo", func(t *testing.T) {
		t.Parallel()
		repo := newFakeRascunhoRepo()
		svc := NewAlteracaoRascunhoService(repo)

		raw := json.RawMessage(`{"quadros":["objeto_social"],"identificacao":{"cnpj":"12.345.678/0001-90","razaoSocial":"Prolink Servicos Ltda","tipoConstituicao":"slu","situacao":"ativa","enderecoAtual":{"logradouro":"Avenida Paulista","bairro":"Bela Vista","municipio":"Sao Paulo","estado":"SP","cep":"01310-100"}}}`)
		issues, err := svc.Salvar(context.Background(), "s1", raw)
		if err != nil || len(issues) > 0 {
			t.Fatalf("esperado sucesso, veio issues=%v err=%v", issues, err)
		}
		if repo.tipoGravado != entity.TipoSLU {
			t.Errorf("tipoGravado = %q, esperado slu", repo.tipoGravado)
		}
		if string(repo.payloadGravado) != string(raw) {
			t.Errorf("payloadGravado divergiu")
		}
	})

	t.Run("chave de topo desconhecida → issues, sem gravar", func(t *testing.T) {
		t.Parallel()
		repo := newFakeRascunhoRepo()
		svc := NewAlteracaoRascunhoService(repo)

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
		svc := NewAlteracaoRascunhoService(newFakeRascunhoRepo())
		issues, err := svc.Salvar(context.Background(), "s1", json.RawMessage(`{}`))
		if err != nil || len(issues) > 0 {
			t.Fatalf("draft vazio deveria passar: issues=%v err=%v", issues, err)
		}
	})

	t.Run("falha de infra vira erro", func(t *testing.T) {
		t.Parallel()
		repo := newFakeRascunhoRepo()
		repo.putPayloadErro = errors.New("dynamo fora do ar")
		svc := NewAlteracaoRascunhoService(repo)

		_, err := svc.Salvar(context.Background(), "s1", json.RawMessage(`{}`))
		if err == nil {
			t.Fatal("esperava erro de infra")
		}
	})
}
