package service

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"go.uber.org/mock/gomock"

	"github.com/tiagods/webtool/apps/api/domain/entity"
	"github.com/tiagods/webtool/apps/api/domain/ports/outbound/mocks"
)

// casoAlteracao devolve o payload `input` do caso nomeado da suíte de
// caracterização da validação de Alteração (domain/validation/testdata).
func casoAlteracao(t *testing.T, nome string) json.RawMessage {
	t.Helper()
	caminho := filepath.Join("..", "validation", "testdata", "casos_alteracao.json")
	dados, err := os.ReadFile(caminho)
	if err != nil {
		t.Fatalf("ler %s: %v", caminho, err)
	}
	var casos []struct {
		Nome  string          `json:"nome"`
		Input json.RawMessage `json:"input"`
	}
	if err := json.Unmarshal(dados, &casos); err != nil {
		t.Fatalf("decodificar casos: %v", err)
	}
	for _, c := range casos {
		if c.Nome == nome {
			return c.Input
		}
	}
	t.Fatalf("caso %q não encontrado em casos_alteracao.json", nome)
	return nil
}

type submitAlteracaoMocks struct {
	protocolo *mocks.MockProtocoloCounter
	storage   *mocks.MockDocumentoStorage
	publisher *mocks.MockSubmissaoPublisher
	repo      *mocks.MockRascunhoRepository
	svc       *AlteracaoSubmitService
}

func novoSubmitAlteracaoMocks(t *testing.T) submitAlteracaoMocks {
	t.Helper()
	ctrl := gomock.NewController(t)
	m := submitAlteracaoMocks{
		protocolo: mocks.NewMockProtocoloCounter(ctrl),
		storage:   mocks.NewMockDocumentoStorage(ctrl),
		publisher: mocks.NewMockSubmissaoPublisher(ctrl),
		repo:      mocks.NewMockRascunhoRepository(ctrl),
	}
	m.svc = NewAlteracaoSubmitService(m.protocolo, m.storage, m.publisher, m.repo)
	return m
}

func TestAlteracaoSubmitService_Submeter(t *testing.T) {
	t.Parallel()

	t.Run("payload inválido → issues e nenhum efeito colateral", func(t *testing.T) {
		t.Parallel()
		m := novoSubmitAlteracaoMocks(t)
		// Nenhuma expectativa: qualquer chamada a um port falha o teste.

		proto, issues, err := m.svc.Submeter(context.Background(), "s1",
			json.RawMessage(`{"quadros":["objeto_social"]}`))
		if err != nil {
			t.Fatalf("erro inesperado: %v", err)
		}
		if proto != "" || len(issues) == 0 {
			t.Fatalf("esperava issues sem protocolo, veio proto=%q issues=%d", proto, len(issues))
		}
	})

	t.Run("caminho feliz: protocolo ALT-, backup JSON, publish, marcar enviado", func(t *testing.T) {
		t.Parallel()
		m := novoSubmitAlteracaoMocks(t)
		payload := casoAlteracao(t, "full_valido_q02")

		gomock.InOrder(
			m.protocolo.EXPECT().Proximo(gomock.Any(), entity.ProtocoloPrefixAlteracao).Return("ALT-2026-000003", nil),
			m.storage.EXPECT().PutJSON(gomock.Any(), "protocolos/ALT-2026-000003/alteracao.json", gomock.Any()).Return(nil),
			m.publisher.EXPECT().Publish(gomock.Any(), entity.SubmissaoMessage{
				SessionID: "s1", Protocolo: "ALT-2026-000003", FormType: entity.FormAlteracao, Tipo: entity.TipoLtda,
			}).Return(nil),
			m.repo.EXPECT().MarcarEnviado(gomock.Any(), "s1", "ALT-2026-000003", entity.TipoLtda).Return(nil),
		)
		// Sem Copy / DeletePrefix: o teste falha se o serviço tentar (form sem upload).

		proto, issues, err := m.svc.Submeter(context.Background(), "s1", payload)
		if err != nil || len(issues) > 0 {
			t.Fatalf("esperava sucesso, veio issues=%v err=%v", issues, err)
		}
		if proto != "ALT-2026-000003" {
			t.Errorf("protocolo = %q", proto)
		}
	})

	t.Run("backup grava o payload verbatim", func(t *testing.T) {
		t.Parallel()
		m := novoSubmitAlteracaoMocks(t)
		payload := casoAlteracao(t, "full_valido_q02")

		m.protocolo.EXPECT().Proximo(gomock.Any(), gomock.Any()).Return("ALT-2026-000009", nil)
		m.storage.EXPECT().PutJSON(gomock.Any(), gomock.Any(), gomock.Cond(func(data any) bool {
			raw, ok := data.(json.RawMessage)
			return ok && string(raw) == string(payload)
		})).Return(nil)
		m.publisher.EXPECT().Publish(gomock.Any(), gomock.Any()).Return(nil)
		m.repo.EXPECT().MarcarEnviado(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).Return(nil)

		if _, _, err := m.svc.Submeter(context.Background(), "s1", payload); err != nil {
			t.Fatalf("erro inesperado: %v", err)
		}
	})

	t.Run("falha no PutJSON aborta antes de publish e marcarEnviado", func(t *testing.T) {
		t.Parallel()
		m := novoSubmitAlteracaoMocks(t)

		m.protocolo.EXPECT().Proximo(gomock.Any(), gomock.Any()).Return("ALT-2026-000003", nil)
		m.storage.EXPECT().PutJSON(gomock.Any(), gomock.Any(), gomock.Any()).Return(errors.New("s3 fora do ar"))
		// Sem Publish / MarcarEnviado: o teste falha se forem chamados.

		_, _, err := m.svc.Submeter(context.Background(), "s1", casoAlteracao(t, "full_valido_q02"))
		if err == nil {
			t.Fatal("esperava erro de infraestrutura")
		}
	})
}
