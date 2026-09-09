//go:build integration

// Testes de integração contra o emulador Floci. Executar com a stack de pé:
//
//	docker compose up -d floci aws-init
//	make test-integration
//
// O endpoint vem de AWS_ENDPOINT_URL (default http://localhost:4566). Cada teste
// cria os próprios recursos (tabela/bucket/fila) com nome único e os remove no
// Cleanup — não depende do provisionamento do aws-init.
package aws

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	awssdk "github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	ddbtypes "github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/aws/aws-sdk-go-v2/service/sqs"

	"github.com/tiagods/webtool/apps/api/infrastructure/config"
)

func testEndpoint() string {
	if v := os.Getenv("AWS_ENDPOINT_URL"); v != "" {
		return v
	}
	return "http://localhost:4566"
}

func testClients(t *testing.T) *Clients {
	t.Helper()
	c, err := NewClients(context.Background(), config.AWS{
		Region:          "us-east-1",
		EndpointURL:     testEndpoint(),
		AccessKeyID:     "test",
		SecretAccessKey: "test",
	})
	if err != nil {
		t.Fatalf("montar clients: %v", err)
	}
	return c
}

func uniqueName(prefix string) string {
	return fmt.Sprintf("%s-%d", prefix, time.Now().UnixNano())
}

// createDraftTable cria uma tabela com PK sessionId (S) — mesmo desenho das
// tabelas de rascunho e de aceite — e agenda a remoção.
func createDraftTable(t *testing.T, c *Clients) string {
	t.Helper()
	name := uniqueName("it-tbl")
	ctx := context.Background()

	if _, err := c.Dynamo.CreateTable(ctx, &dynamodb.CreateTableInput{
		TableName:   awssdk.String(name),
		BillingMode: ddbtypes.BillingModePayPerRequest,
		AttributeDefinitions: []ddbtypes.AttributeDefinition{
			{AttributeName: awssdk.String("sessionId"), AttributeType: ddbtypes.ScalarAttributeTypeS},
		},
		KeySchema: []ddbtypes.KeySchemaElement{
			{AttributeName: awssdk.String("sessionId"), KeyType: ddbtypes.KeyTypeHash},
		},
	}); err != nil {
		t.Fatalf("criar tabela %s: %v", name, err)
	}

	t.Cleanup(func() {
		_, _ = c.Dynamo.DeleteTable(context.Background(), &dynamodb.DeleteTableInput{
			TableName: awssdk.String(name),
		})
	})
	return name
}

func createBucket(t *testing.T, c *Clients) string {
	t.Helper()
	name := uniqueName("it-bucket")

	if _, err := c.S3.CreateBucket(context.Background(), &s3.CreateBucketInput{
		Bucket: awssdk.String(name),
	}); err != nil {
		t.Fatalf("criar bucket %s: %v", name, err)
	}

	t.Cleanup(func() {
		emptyBucket(c, name)
		_, _ = c.S3.DeleteBucket(context.Background(), &s3.DeleteBucketInput{Bucket: awssdk.String(name)})
	})
	return name
}

func emptyBucket(c *Clients, bucket string) {
	ctx := context.Background()
	for {
		list, err := c.S3.ListObjectsV2(ctx, &s3.ListObjectsV2Input{Bucket: awssdk.String(bucket)})
		if err != nil || len(list.Contents) == 0 {
			return
		}
		ids := make([]s3types.ObjectIdentifier, 0, len(list.Contents))
		for _, obj := range list.Contents {
			ids = append(ids, s3types.ObjectIdentifier{Key: obj.Key})
		}
		if _, err := c.S3.DeleteObjects(ctx, &s3.DeleteObjectsInput{
			Bucket: awssdk.String(bucket),
			Delete: &s3types.Delete{Objects: ids},
		}); err != nil {
			return
		}
		if list.IsTruncated == nil || !*list.IsTruncated {
			return
		}
	}
}

func createQueue(t *testing.T, c *Clients) string {
	t.Helper()
	name := uniqueName("it-queue")

	out, err := c.SQS.CreateQueue(context.Background(), &sqs.CreateQueueInput{
		QueueName: awssdk.String(name),
	})
	if err != nil {
		t.Fatalf("criar fila %s: %v", name, err)
	}

	t.Cleanup(func() {
		_, _ = c.SQS.DeleteQueue(context.Background(), &sqs.DeleteQueueInput{QueueUrl: out.QueueUrl})
	})
	return *out.QueueUrl
}
