//go:build integration

package aws

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	awssdk "github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/sqs"

	"github.com/tiagods/webtool/apps/backend/domain/entity"
)

func TestSQSSubmissaoPublisher_PublishReceive(t *testing.T) {
	c := testClients(t)
	queueURL := createQueue(t, c)
	pub := NewSQSSubmissaoPublisher(c.SQS, queueURL)
	ctx := context.Background()

	msg := entity.SubmissaoMessage{
		SessionID: uniqueName("sess"),
		Protocolo: "PRO-2026-000007",
		FormType:  entity.FormAbertura,
		Tipo:      entity.TipoLtda,
	}
	if err := pub.Publish(ctx, msg); err != nil {
		t.Fatalf("Publish: %v", err)
	}

	out, err := c.SQS.ReceiveMessage(ctx, &sqs.ReceiveMessageInput{
		QueueUrl:            awssdk.String(queueURL),
		MaxNumberOfMessages: 1,
		WaitTimeSeconds:     3,
	})
	if err != nil {
		t.Fatalf("ReceiveMessage: %v", err)
	}
	if len(out.Messages) != 1 {
		t.Fatalf("esperava 1 mensagem, veio %d", len(out.Messages))
	}

	var got entity.SubmissaoMessage
	if err := json.Unmarshal([]byte(*out.Messages[0].Body), &got); err != nil {
		t.Fatalf("decodificar corpo: %v", err)
	}
	if got != msg {
		t.Fatalf("mensagem recebida %+v, esperava %+v", got, msg)
	}
}

func TestSQSSubmissaoPublisher_OmiteTipoVazio(t *testing.T) {
	c := testClients(t)
	queueURL := createQueue(t, c)
	pub := NewSQSSubmissaoPublisher(c.SQS, queueURL)
	ctx := context.Background()

	msg := entity.SubmissaoMessage{
		SessionID: uniqueName("sess"),
		Protocolo: "PRO-2026-000008",
		FormType:  entity.FormAlteracao,
	}
	if err := pub.Publish(ctx, msg); err != nil {
		t.Fatalf("Publish: %v", err)
	}

	out, err := c.SQS.ReceiveMessage(ctx, &sqs.ReceiveMessageInput{
		QueueUrl:            awssdk.String(queueURL),
		MaxNumberOfMessages: 1,
		WaitTimeSeconds:     3,
	})
	if err != nil {
		t.Fatalf("ReceiveMessage: %v", err)
	}
	if len(out.Messages) != 1 {
		t.Fatalf("esperava 1 mensagem, veio %d", len(out.Messages))
	}
	if body := *out.Messages[0].Body; strings.Contains(body, "tipo") {
		t.Fatalf("corpo não deveria conter \"tipo\": %s", body)
	}
}
