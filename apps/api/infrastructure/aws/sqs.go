package aws

import (
	"context"
	"encoding/json"
	"fmt"

	awssdk "github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/sqs"

	"github.com/tiagods/webtool/apps/api/domain/entity"
	"github.com/tiagods/webtool/apps/api/domain/ports/outbound"
)

// SQSSubmissaoPublisher implementa outbound.SubmissaoPublisher enviando o corpo
// JSON da SubmissaoMessage para a fila que o worker consome.
type SQSSubmissaoPublisher struct {
	client   *sqs.Client
	queueURL string
}

var _ outbound.SubmissaoPublisher = (*SQSSubmissaoPublisher)(nil)

// NewSQSSubmissaoPublisher liga o publisher a um client e à URL da fila.
func NewSQSSubmissaoPublisher(client *sqs.Client, queueURL string) *SQSSubmissaoPublisher {
	return &SQSSubmissaoPublisher{client: client, queueURL: queueURL}
}

// Publish serializa msg e a envia via SendMessage.
func (p *SQSSubmissaoPublisher) Publish(ctx context.Context, msg entity.SubmissaoMessage) error {
	body, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("serializar mensagem de submissão: %w", err)
	}

	if _, err := p.client.SendMessage(ctx, &sqs.SendMessageInput{
		QueueUrl:    awssdk.String(p.queueURL),
		MessageBody: awssdk.String(string(body)),
	}); err != nil {
		return fmt.Errorf("publicar mensagem de submissão: %w", err)
	}
	return nil
}
