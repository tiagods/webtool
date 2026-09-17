package service

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"go.uber.org/mock/gomock"

	"github.com/tiagods/webtool/apps/backend/domain/entity"
	"github.com/tiagods/webtool/apps/backend/domain/ports/outbound/mocks"
)

// casoValido devolve o payload `input` do caso nomeado da suíte de
// caracterização da validação (domain/validation/testdata), reusando os
// formulários válidos dela.
func casoValido(t *testing.T, nome string) json.RawMessage {
	t.Helper()
	caminho := filepath.Join("..", "validation", "testdata", "casos_abertura.json")
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
	t.Fatalf("caso %q não encontrado em casos_abertura.json", nome)
	return nil
}

type submitMocks struct {
	repo      *mocks.MockRascunhoRepository
	protocolo *mocks.MockProtocoloCounter
	publisher *mocks.MockSubmissaoPublisher
	storage   *mocks.MockDocumentoStorage
	svc       *SubmitService
}

func novoSubmitMocks(t *testing.T) submitMocks {
	t.Helper()
	ctrl := gomock.NewController(t)
	m := submitMocks{
		repo:      mocks.NewMockRascunhoRepository(ctrl),
		protocolo: mocks.NewMockProtocoloCounter(ctrl),
		publisher: mocks.NewMockSubmissaoPublisher(ctrl),
		storage:   mocks.NewMockDocumentoStorage(ctrl),
	}
	m.svc = NewSubmitService(m.repo, m.protocolo, m.publisher, m.storage)
	return m
}

func TestSubmitService_Submeter(t *testing.T) {
	t.Parallel()

	t.Run("payload inválido → issues e nenhum efeito colateral", func(t *testing.T) {
		t.Parallel()
		m := novoSubmitMocks(t)
		// Nenhuma expectativa: qualquer chamada a um port falha o teste.

		proto, issues, err := m.svc.Submeter(context.Background(), "s1",
			json.RawMessage(`{"dadosEmpresa":{"tipoConstituicao":"ltda"}}`))
		if err != nil {
			t.Fatalf("erro inesperado: %v", err)
		}
		if proto != "" || len(issues) == 0 {
			t.Fatalf("esperava issues sem protocolo, veio proto=%q issues=%d", proto, len(issues))
		}
	})

	t.Run("caminho feliz Ltda: protocolo, cópias, publish, marcar enviado, limpeza", func(t *testing.T) {
		t.Parallel()
		m := novoSubmitMocks(t)

		m.repo.EXPECT().Get(gomock.Any(), "s1").Return(&entity.Rascunho{
			SessionID: "s1",
			Status:    entity.StatusRascunho,
			DocumentosKeys: map[string]string{
				"contrato_social": "s1/documentos/contrato_social.pdf",
				"rg_socio_1":      "s1/documentos/rg_socio_1.jpg",
			},
		}, nil)
		m.protocolo.EXPECT().Proximo(gomock.Any(), entity.ProtocoloPrefixAbertura).Return("PRO-2026-000007", nil)
		m.storage.EXPECT().Copy(gomock.Any(), "s1/documentos/contrato_social.pdf", "protocolos/PRO-2026-000007/contrato_social.pdf").Return(nil)
		m.storage.EXPECT().Copy(gomock.Any(), "s1/documentos/rg_socio_1.jpg", "protocolos/PRO-2026-000007/rg_socio_1.jpg").Return(nil)
		m.publisher.EXPECT().Publish(gomock.Any(), entity.SubmissaoMessage{
			SessionID: "s1", Protocolo: "PRO-2026-000007", FormType: entity.FormAbertura, Tipo: entity.TipoLtda,
		}).Return(nil)
		m.repo.EXPECT().MarcarEnviado(gomock.Any(), "s1", "PRO-2026-000007", entity.TipoLtda).Return(nil)
		m.storage.EXPECT().DeletePrefix(gomock.Any(), "s1/").Return(nil)

		proto, issues, err := m.svc.Submeter(context.Background(), "s1", casoValido(t, "full_ltda_valido"))
		if err != nil || len(issues) > 0 {
			t.Fatalf("esperava sucesso, veio issues=%v err=%v", issues, err)
		}
		if proto != "PRO-2026-000007" {
			t.Errorf("protocolo = %q", proto)
		}
	})

	t.Run("ordem: copy → publish → marcarEnviado → deletePrefix", func(t *testing.T) {
		t.Parallel()
		m := novoSubmitMocks(t)

		m.repo.EXPECT().Get(gomock.Any(), "s1").Return(&entity.Rascunho{
			SessionID:      "s1",
			Status:         entity.StatusRascunho,
			DocumentosKeys: map[string]string{"rg": "s1/documentos/rg.pdf"},
		}, nil)
		m.protocolo.EXPECT().Proximo(gomock.Any(), gomock.Any()).Return("PRO-2026-000007", nil)
		gomock.InOrder(
			m.storage.EXPECT().Copy(gomock.Any(), gomock.Any(), gomock.Any()).Return(nil),
			m.publisher.EXPECT().Publish(gomock.Any(), gomock.Any()).Return(nil),
			m.repo.EXPECT().MarcarEnviado(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).Return(nil),
			m.storage.EXPECT().DeletePrefix(gomock.Any(), "s1/").Return(nil),
		)

		if _, _, err := m.svc.Submeter(context.Background(), "s1", casoValido(t, "full_ltda_valido")); err != nil {
			t.Fatalf("erro inesperado: %v", err)
		}
	})

	t.Run("rascunho sem documentosKeys → 0 cópias, segue normal", func(t *testing.T) {
		t.Parallel()
		m := novoSubmitMocks(t)

		m.repo.EXPECT().Get(gomock.Any(), "s1").Return(&entity.Rascunho{SessionID: "s1", Status: entity.StatusRascunho}, nil)
		m.protocolo.EXPECT().Proximo(gomock.Any(), gomock.Any()).Return("PRO-2026-000009", nil)
		m.publisher.EXPECT().Publish(gomock.Any(), gomock.Cond(func(msg entity.SubmissaoMessage) bool {
			return msg.Tipo == entity.TipoSLU && msg.Protocolo == "PRO-2026-000009"
		})).Return(nil)
		m.repo.EXPECT().MarcarEnviado(gomock.Any(), "s1", "PRO-2026-000009", entity.TipoSLU).Return(nil)
		m.storage.EXPECT().DeletePrefix(gomock.Any(), "s1/").Return(nil)
		// Sem EXPECT().Copy → o teste falha se o serviço tentar copiar algo.

		proto, _, err := m.svc.Submeter(context.Background(), "s1", casoValido(t, "full_slu_valido"))
		if err != nil || proto == "" {
			t.Fatalf("esperava sucesso, veio proto=%q err=%v", proto, err)
		}
	})

	t.Run("falha numa cópia S3 aborta antes de publish e marcarEnviado", func(t *testing.T) {
		t.Parallel()
		m := novoSubmitMocks(t)

		m.repo.EXPECT().Get(gomock.Any(), "s1").Return(&entity.Rascunho{
			SessionID:      "s1",
			Status:         entity.StatusRascunho,
			DocumentosKeys: map[string]string{"rg": "s1/documentos/rg.pdf"},
		}, nil)
		m.protocolo.EXPECT().Proximo(gomock.Any(), gomock.Any()).Return("PRO-2026-000007", nil)
		m.storage.EXPECT().Copy(gomock.Any(), gomock.Any(), gomock.Any()).Return(errors.New("s3 fora do ar"))
		// Sem Publish / MarcarEnviado / DeletePrefix: o teste falha se forem chamados.

		_, _, err := m.svc.Submeter(context.Background(), "s1", casoValido(t, "full_ltda_valido"))
		if err == nil {
			t.Fatal("esperava erro de infraestrutura")
		}
	})
}

func TestDestinoDocumento(t *testing.T) {
	t.Parallel()
	got := destinoDocumento("sess-abc/documentos/contrato_social.pdf", "sess-abc", "PRO-2026-000042")
	if got != "protocolos/PRO-2026-000042/contrato_social.pdf" {
		t.Errorf("destinoDocumento = %q", got)
	}
}
