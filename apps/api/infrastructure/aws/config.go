// Package aws monta os clients aws-sdk-go-v2 e implementa os ports outbound do
// domínio (RascunhoRepository, AceiteRepository, ProtocoloCounter,
// DocumentoStorage, SubmissaoPublisher) sobre DynamoDB, S3 e SQS.
package aws

import (
	"context"
	"fmt"

	awssdk "github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/sqs"

	"github.com/tiagods/webtool/apps/api/infrastructure/config"
)

// Clients agrupa os clients AWS já configurados. São montados uma única vez no
// ponto de composição (infrastructure.StartApp) e injetados nos adapters.
type Clients struct {
	Dynamo *dynamodb.Client
	S3     *s3.Client
	SQS    *sqs.Client
}

// NewClients monta os clients a partir da configuração AWS. Com endpoint
// customizado (emulador local Floci) usa credenciais estáticas, o endpoint fixo
// e path-style no S3; sem ele, cai na cadeia padrão de credenciais e resolução
// de endpoint do SDK (produção).
func NewClients(ctx context.Context, cfg config.AWS) (*Clients, error) {
	loadOpts := []func(*awsconfig.LoadOptions) error{awsconfig.WithRegion(cfg.Region)}
	if cfg.UsesCustomEndpoint() {
		loadOpts = append(loadOpts, awsconfig.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
		))
	}

	awsCfg, err := awsconfig.LoadDefaultConfig(ctx, loadOpts...)
	if err != nil {
		return nil, fmt.Errorf("carregar configuração AWS: %w", err)
	}

	endpoint := cfg.EndpointURL

	return &Clients{
		Dynamo: dynamodb.NewFromConfig(awsCfg, func(o *dynamodb.Options) {
			if endpoint != "" {
				o.BaseEndpoint = awssdk.String(endpoint)
			}
		}),
		S3: s3.NewFromConfig(awsCfg, func(o *s3.Options) {
			if endpoint != "" {
				o.BaseEndpoint = awssdk.String(endpoint)
				o.UsePathStyle = true
			}
		}),
		SQS: sqs.NewFromConfig(awsCfg, func(o *sqs.Options) {
			if endpoint != "" {
				o.BaseEndpoint = awssdk.String(endpoint)
			}
		}),
	}, nil
}
