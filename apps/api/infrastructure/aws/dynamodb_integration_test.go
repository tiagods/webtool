//go:build integration

package aws

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	awssdk "github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	ddbtypes "github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	"github.com/tiagods/webtool/apps/api/domain/entity"
)

func TestDynamoRascunhoRepository_CicloDeVida(t *testing.T) {
	c := testClients(t)
	table := createDraftTable(t, c)
	repo := NewDynamoRascunhoRepository(c.Dynamo, table)
	ctx := context.Background()
	sid := uniqueName("sess")

	if got, err := repo.Get(ctx, sid); err != nil || got != nil {
		t.Fatalf("sessão inexistente: esperava (nil, nil), veio (%v, %v)", got, err)
	}

	// EnsureInicial é idempotente.
	if err := repo.EnsureInicial(ctx, sid); err != nil {
		t.Fatalf("EnsureInicial (1): %v", err)
	}
	if err := repo.EnsureInicial(ctx, sid); err != nil {
		t.Fatalf("EnsureInicial (2): %v", err)
	}

	got, err := repo.Get(ctx, sid)
	if err != nil {
		t.Fatalf("Get após EnsureInicial: %v", err)
	}
	if got.Status != entity.StatusRascunho {
		t.Fatalf("status = %q, esperava %q", got.Status, entity.StatusRascunho)
	}
	if got.DocumentosKeys == nil {
		t.Fatal("documentosKeys deveria ser mapa vazio, veio nil")
	}
	if got.TTL <= time.Now().Unix() {
		t.Fatalf("ttl %d não está no futuro", got.TTL)
	}
	createdAt := got.CreatedAt

	// PutPayload grava o payload e denormaliza o tipo, sem mudar o status.
	payload := json.RawMessage(`{"dadosEmpresa":{"razaoSocial":"ACME LTDA","capitalSocial":1000}}`)
	if err := repo.PutPayload(ctx, sid, payload, entity.TipoLtda); err != nil {
		t.Fatalf("PutPayload: %v", err)
	}
	got, _ = repo.Get(ctx, sid)
	if got.Tipo != entity.TipoLtda {
		t.Fatalf("tipo = %q, esperava %q", got.Tipo, entity.TipoLtda)
	}
	if got.Status != entity.StatusRascunho {
		t.Fatalf("PutPayload não deveria mudar o status, veio %q", got.Status)
	}
	if !jsonIgual(t, got.Payload, payload) {
		t.Fatalf("payload não faz round-trip: %s", got.Payload)
	}
	if !got.CreatedAt.Equal(createdAt) {
		t.Fatalf("createdAt mudou: %v -> %v", createdAt, got.CreatedAt)
	}

	// PutDocumentoKey mescla no mapa.
	key := sid + "/contratoSocial.pdf"
	if err := repo.PutDocumentoKey(ctx, sid, "contratoSocial", key); err != nil {
		t.Fatalf("PutDocumentoKey: %v", err)
	}
	got, _ = repo.Get(ctx, sid)
	if got.DocumentosKeys["contratoSocial"] != key {
		t.Fatalf("documentosKeys[contratoSocial] = %q, esperava %q", got.DocumentosKeys["contratoSocial"], key)
	}

	// MarcarEnviado transiciona e zera os dados sensíveis no mesmo update.
	protocolo := "PRO-2026-000042"
	if err := repo.MarcarEnviado(ctx, sid, protocolo, entity.TipoLtda); err != nil {
		t.Fatalf("MarcarEnviado: %v", err)
	}
	got, _ = repo.Get(ctx, sid)
	if got.Status != entity.StatusEnviado {
		t.Fatalf("status = %q, esperava %q", got.Status, entity.StatusEnviado)
	}
	if got.Protocolo != protocolo {
		t.Fatalf("protocolo = %q, esperava %q", got.Protocolo, protocolo)
	}
	if got.Payload != nil {
		t.Fatalf("payload deveria ser nil após envio, veio %s", got.Payload)
	}
	if got.DocumentosKeys != nil {
		t.Fatalf("documentosKeys deveria ser nil após envio, veio %v", got.DocumentosKeys)
	}
	esperadoTTL := time.Now().Add(ttlEnviado).Unix()
	if diff := esperadoTTL - got.TTL; diff < -120 || diff > 120 {
		t.Fatalf("ttl pós-envio %d longe de now+30d (%d)", got.TTL, esperadoTTL)
	}

	// Delete remove o item.
	if err := repo.Delete(ctx, sid); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if got, err := repo.Get(ctx, sid); err != nil || got != nil {
		t.Fatalf("após Delete esperava (nil, nil), veio (%v, %v)", got, err)
	}
}

func TestDynamoProtocoloCounter_Sequencial(t *testing.T) {
	c := testClients(t)
	table := createDraftTable(t, c)
	counter := NewDynamoProtocoloCounter(c.Dynamo, table)
	ctx := context.Background()
	ano := time.Now().UTC().Year()

	for i := 1; i <= 3; i++ {
		got, err := counter.Proximo(ctx, "PRO-")
		if err != nil {
			t.Fatalf("Proximo (%d): %v", i, err)
		}
		want := fmt.Sprintf("PRO-%d-%06d", ano, i)
		if got != want {
			t.Fatalf("protocolo %d = %q, esperava %q", i, got, want)
		}
	}
}

func TestDynamoAceiteRepository_PutComTTL(t *testing.T) {
	c := testClients(t)
	table := createDraftTable(t, c)
	repo := NewDynamoAceiteRepository(c.Dynamo, table)
	ctx := context.Background()

	aceitoEm := time.Now().UTC()
	reg := entity.RegistroAceite{
		SessionID:   uniqueName("aceite"),
		VersaoTermo: "2026-01",
		AceitoEm:    aceitoEm.Format(time.RFC3339),
		IP:          "203.0.113.7",
		UserAgent:   "Mozilla/5.0 (Test)",
	}
	if err := repo.Put(ctx, reg); err != nil {
		t.Fatalf("Put: %v", err)
	}

	out, err := c.Dynamo.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: awssdk.String(table),
		Key: map[string]ddbtypes.AttributeValue{
			"sessionId": &ddbtypes.AttributeValueMemberS{Value: reg.SessionID},
		},
	})
	if err != nil {
		t.Fatalf("GetItem: %v", err)
	}
	var item struct {
		VersaoTermo string `dynamodbav:"versaoTermo"`
		IP          string `dynamodbav:"ip"`
		TTL         int64  `dynamodbav:"ttl"`
	}
	if err := attributevalue.UnmarshalMap(out.Item, &item); err != nil {
		t.Fatalf("UnmarshalMap: %v", err)
	}
	if item.VersaoTermo != reg.VersaoTermo || item.IP != reg.IP {
		t.Fatalf("item gravado inconsistente: %+v", item)
	}
	esperadoTTL := aceitoEm.Add(ttlAceite).Unix()
	if diff := esperadoTTL - item.TTL; diff < -120 || diff > 120 {
		t.Fatalf("ttl %d longe de aceitoEm+5anos (%d)", item.TTL, esperadoTTL)
	}
}

func jsonIgual(t *testing.T, a, b json.RawMessage) bool {
	t.Helper()
	var av, bv any
	if err := json.Unmarshal(a, &av); err != nil {
		t.Fatalf("unmarshal a: %v", err)
	}
	if err := json.Unmarshal(b, &bv); err != nil {
		t.Fatalf("unmarshal b: %v", err)
	}
	aj, _ := json.Marshal(av)
	bj, _ := json.Marshal(bv)
	return string(aj) == string(bj)
}
