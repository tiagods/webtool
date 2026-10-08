//go:build integration

package infrastructure

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"go.uber.org/mock/gomock"

	"github.com/tiagods/webtool/apps/backend/domain/entity"
	"github.com/tiagods/webtool/apps/backend/domain/ports/outbound"
	testhelpers "github.com/tiagods/webtool/apps/backend/infrastructure/testhelpers"
)

func TestIntegrationWorker_ProcessaAbertura(t *testing.T) {
	d := testhelpers.SetupIntegration(t)
	ctx := context.Background()

	sessionID := "worker-sess-abertura"
	payload := json.RawMessage(casoAbertura(t, "full_ltda_valido"))

	// Semeia rascunho e objetos no Dynamo/S3
	err := d.AberturaRepo.EnsureInicial(ctx, sessionID)
	if err != nil {
		t.Fatalf("EnsureInicial: %v", err)
	}
	err = d.AberturaRepo.PutPayload(ctx, sessionID, payload, entity.TipoLtda)
	if err != nil {
		t.Fatalf("PutPayload: %v", err)
	}
	err = d.AberturaRepo.PutDocumentoKey(ctx, sessionID, "contrato_social", sessionID+"/contrato_social.pdf")
	if err != nil {
		t.Fatalf("PutDocumentoKey: %v", err)
	}
	seedS3Object(d, t, sessionID+"/contrato_social.pdf", "application/pdf", "%PDF-1.4 conteudo")

	// Captura o DTO da notificação enviado ao canal configurado
	var recebida *outbound.NotificacaoAbertura
	d.Notificacoes.EXPECT().
		EnviarAbertura(gomock.Any(), gomock.Any()).
		DoAndReturn(func(_ context.Context, n outbound.NotificacaoAbertura) error {
			recebida = &n
			return nil
		})

	// Executa o worker
	msg := entity.SubmissaoMessage{
		SessionID: sessionID,
		Protocolo: "PRO-2026-000999",
		FormType:  entity.FormAbertura,
		Tipo:      entity.TipoLtda,
	}
	err = d.Notificar.Processar(ctx, msg)
	if err != nil {
		t.Fatalf("Processar (abertura): %v", err)
	}

	// Verifica a notificação
	if recebida == nil {
		t.Fatal("notificação não enviada")
	}
	if recebida.Protocolo != "PRO-2026-000999" {
		t.Fatalf("protocolo = %q", recebida.Protocolo)
	}
	if recebida.DataHora.IsZero() {
		t.Fatal("dataHora zerada")
	}
	if len(recebida.Documentos) != 1 {
		t.Fatalf("documentos = %d, esperado 1", len(recebida.Documentos))
	}
	if recebida.Documentos[0].URL == "" {
		t.Fatal("URL de download vazia")
	}
}

func TestIntegrationWorker_ProcessaAlteracao(t *testing.T) {
	d := testhelpers.SetupIntegration(t)
	ctx := context.Background()

	sessionID := "worker-sess-alteracao"
	payload := json.RawMessage(casoAlteracao(t, "full_valido_q02"))

	err := d.AberturaRepo.EnsureInicial(ctx, sessionID)
	if err != nil {
		t.Fatalf("EnsureInicial: %v", err)
	}
	err = d.AberturaRepo.PutPayload(ctx, sessionID, payload, "")
	if err != nil {
		t.Fatalf("PutPayload: %v", err)
	}

	var recebida *outbound.NotificacaoAlteracao
	d.Notificacoes.EXPECT().
		EnviarAlteracao(gomock.Any(), gomock.Any()).
		DoAndReturn(func(_ context.Context, n outbound.NotificacaoAlteracao) error {
			recebida = &n
			return nil
		})

	msg := entity.SubmissaoMessage{
		SessionID: sessionID,
		Protocolo: "ALT-2026-000042",
		FormType:  entity.FormAlteracao,
	}
	err = d.Notificar.Processar(ctx, msg)
	if err != nil {
		t.Fatalf("Processar (alteracao): %v", err)
	}

	if recebida == nil {
		t.Fatal("notificação não enviada")
	}
	if recebida.Protocolo != "ALT-2026-000042" {
		t.Fatalf("protocolo = %q", recebida.Protocolo)
	}
	if len(recebida.Quadros) != 1 || recebida.Quadros[0] != "objeto_social" {
		t.Fatalf("quadros = %v, esperado [objeto_social]", recebida.Quadros)
	}
}

func TestIntegrationWorker_IgnoraRascunhoAusente(t *testing.T) {
	d := testhelpers.SetupIntegration(t)
	ctx := context.Background()

	// Sem rascunho, o worker não notifica ninguém
	d.Notificacoes.EXPECT().EnviarAbertura(gomock.Any(), gomock.Any()).Times(0)
	d.Notificacoes.EXPECT().EnviarAlteracao(gomock.Any(), gomock.Any()).Times(0)

	msg := entity.SubmissaoMessage{
		SessionID: "inexistente",
		Protocolo: "PRO-2026-000000",
		FormType:  entity.FormAbertura,
	}
	err := d.Notificar.Processar(ctx, msg)
	if err != nil {
		t.Fatalf("Processar com rascunho ausente deveria ser no-op: %v", err)
	}
}

func TestIntegrationWorker_FormTypeInvalido(t *testing.T) {
	d := testhelpers.SetupIntegration(t)
	ctx := context.Background()

	// Precisa ter rascunho para chegar na validação de FormType
	sessionID := "worker-sess-invalido"
	payload := json.RawMessage(`{"dadosEmpresa":{"tipoConstituicao":"ltda"}}`)
	d.AberturaRepo.EnsureInicial(ctx, sessionID)
	d.AberturaRepo.PutPayload(ctx, sessionID, payload, entity.TipoLtda)

	msg := entity.SubmissaoMessage{
		SessionID: sessionID,
		Protocolo: "INV-2026-000001",
		FormType:  entity.FormType("invalido"),
	}
	err := d.Notificar.Processar(ctx, msg)
	if err == nil {
		t.Fatal("esperava erro para FormType inválido")
	}
	if !strings.Contains(err.Error(), "formType desconhecido") {
		t.Fatalf("erro inesperado: %v", err)
	}
}

func TestIntegrationWorker_MultiplosDocumentos(t *testing.T) {
	d := testhelpers.SetupIntegration(t)
	ctx := context.Background()

	sessionID := "worker-sess-multidocs"
	payload := json.RawMessage(casoAbertura(t, "full_ltda_valido"))

	d.AberturaRepo.EnsureInicial(ctx, sessionID)
	d.AberturaRepo.PutPayload(ctx, sessionID, payload, entity.TipoLtda)

	docs := []string{"rg_socio_1", "cpf_socio_1", "comprovante_residencia"}
	for _, doc := range docs {
		s3key := sessionID + "/documentos/" + doc + ".pdf"
		d.AberturaRepo.PutDocumentoKey(ctx, sessionID, doc, s3key)
		seedS3Object(d, t, s3key, "application/pdf", "%PDF-1.4 "+doc)
	}

	var recebida *outbound.NotificacaoAbertura
	d.Notificacoes.EXPECT().
		EnviarAbertura(gomock.Any(), gomock.Any()).
		DoAndReturn(func(_ context.Context, n outbound.NotificacaoAbertura) error {
			recebida = &n
			return nil
		})

	msg := entity.SubmissaoMessage{
		SessionID: sessionID,
		Protocolo: "PRO-2026-000888",
		FormType:  entity.FormAbertura,
		Tipo:      entity.TipoLtda,
	}
	err := d.Notificar.Processar(ctx, msg)
	if err != nil {
		t.Fatalf("Processar: %v", err)
	}

	if recebida == nil {
		t.Fatal("notificação não enviada")
	}
	if len(recebida.Documentos) != 3 {
		t.Fatalf("documentos = %d, esperado 3", len(recebida.Documentos))
	}
	for _, doc := range recebida.Documentos {
		if doc.Label == "" || doc.URL == "" {
			t.Fatalf("documento sem label/URL: %+v", doc)
		}
	}
}
