//go:build integration

package infrastructure

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/tiagods/webtool/apps/backend/domain/entity"
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

	// Verifica email
	email := d.EmailMock.Ultimo()
	if email == nil {
		t.Fatal("email não enviado")
	}
	if !strings.Contains(email.Subject, "Nova abertura") {
		t.Fatalf("assunto = %q", email.Subject)
	}
	if len(email.BodyHTML) == 0 {
		t.Fatal("body HTML vazio")
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

	msg := entity.SubmissaoMessage{
		SessionID: sessionID,
		Protocolo: "ALT-2026-000042",
		FormType:  entity.FormAlteracao,
	}
	err = d.Notificar.Processar(ctx, msg)
	if err != nil {
		t.Fatalf("Processar (alteracao): %v", err)
	}

	email := d.EmailMock.Ultimo()
	if email == nil {
		t.Fatal("email não enviado")
	}
	if !strings.Contains(email.Subject, "Nova alteração") {
		t.Fatalf("assunto = %q", email.Subject)
	}
}

func TestIntegrationWorker_IgnoraRascunhoAusente(t *testing.T) {
	d := testhelpers.SetupIntegration(t)
	ctx := context.Background()

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

	email := d.EmailMock.Ultimo()
	if email == nil {
		t.Fatal("email não enviado")
	}
	if len(email.BodyHTML) == 0 {
		t.Fatal("body HTML vazio")
	}
}