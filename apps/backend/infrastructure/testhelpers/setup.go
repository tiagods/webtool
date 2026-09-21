//go:build integration

package testhelpers

import (
	"context"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	awssdk "github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	ddbtypes "github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
	"github.com/labstack/echo/v4"

	"github.com/tiagods/webtool/apps/backend/adapter/web"
	"github.com/tiagods/webtool/apps/backend/domain/ports/outbound"
	"github.com/tiagods/webtool/apps/backend/domain/service"
	infraaws "github.com/tiagods/webtool/apps/backend/infrastructure/aws"
	"github.com/tiagods/webtool/apps/backend/infrastructure/auth"
	"github.com/tiagods/webtool/apps/backend/infrastructure/config"
	"github.com/tiagods/webtool/apps/backend/infrastructure/ratelimit"
)

type MockEmailSender struct {
	mu       sync.Mutex
	Enviados []outbound.EmailData
}

func (m *MockEmailSender) Send(_ context.Context, data outbound.EmailData) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Enviados = append(m.Enviados, data)
	return nil
}

func (m *MockEmailSender) Ultimo() *outbound.EmailData {
	m.mu.Lock()
	defer m.mu.Unlock()
	if len(m.Enviados) == 0 {
		return nil
	}
	return &m.Enviados[len(m.Enviados)-1]
}

func (m *MockEmailSender) Reset() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Enviados = nil
}

type TestDeps struct {
	DynamoTable   string
	S3Bucket      string
	SQSQueueURL   string
	Echo          *echo.Echo
	Clients       *infraaws.Clients
	EmailMock     *MockEmailSender
	Tokens        outbound.TokenService
	AberturaRepo  *infraaws.DynamoRascunhoRepository
	AlteracaoRepo *infraaws.DynamoRascunhoRepository
	Notificar     *service.NotificarSubmissao
}

var (
	cleanupFn func()
	setupOnce sync.Once
	deps      *TestDeps
)

// SetupTestMain is called from TestMain — no *testing.T, uses panic.
func SetupTestMain() {
	setupOnce.Do(func() {
		ctx := context.Background()
		endpoint := testEndpoint()
		clients, err := infraaws.NewClients(ctx, config.AWS{
			Region:          "us-east-1",
			EndpointURL:     endpoint,
			AccessKeyID:     "test",
			SecretAccessKey: "test",
		})
		if err != nil {
			panic("montar clients AWS: " + err.Error())
		}
		table := createOrReplaceDynamoTableTM(clients)
		bucket := createOrReplaceBucketTM(ctx, clients)
		queueURL := createOrReplaceQueueTM(clients)

		aberturaRepo := infraaws.NewDynamoRascunhoRepository(clients.Dynamo, table)
		alteracaoRepo := infraaws.NewDynamoRascunhoRepository(clients.Dynamo, table)
		aceiteRepo := infraaws.NewDynamoAceiteRepository(clients.Dynamo, table)
		storage := infraaws.NewS3ObjectStorage(clients.S3, bucket)
		aberturaProtocolo := infraaws.NewDynamoProtocoloCounter(clients.Dynamo, table)
		alteracaoProtocolo := infraaws.NewDynamoProtocoloCounter(clients.Dynamo, table)
		submissoes := infraaws.NewSQSSubmissaoPublisher(clients.SQS, queueURL)
		tokens := auth.NewJWTTokenService("test-secret", 30*time.Minute)
		emailMock := &MockEmailSender{}

		e := web.NewRouter(web.Deps{
			Aceite:            service.NewAceiteService(aceiteRepo, tokens),
			Sessao:            service.NewSessaoService(aberturaRepo, alteracaoRepo, tokens, storage),
			Rascunho:          service.NewRascunhoService(aberturaRepo),
			Upload:            service.NewUploadService(storage, service.PresignUploadExpiraEm),
			Submit:            service.NewSubmitService(aberturaRepo, aberturaProtocolo, submissoes, storage),
			RascunhoAlteracao: service.NewAlteracaoRascunhoService(alteracaoRepo),
			SubmitAlteracao:   service.NewAlteracaoSubmitService(alteracaoProtocolo, storage, submissoes, alteracaoRepo),
			Tokens:            tokens,
			Cookies:           auth.NewCookieBuilder(false, 30*time.Minute),
			RateLimit:         ratelimit.NewFixedWindow(100000, ratelimit.PadraoJanela),
		})

		notificar := service.NewNotificarSubmissao(aberturaRepo, storage, emailMock, "test@prolink.local")

		cleanupFn = func() {
			e.Shutdown(context.Background())
			deleteDynamoTable(context.Background(), clients, table)
			emptyBucket(context.Background(), clients, bucket)
			clients.S3.DeleteBucket(context.Background(), &s3.DeleteBucketInput{Bucket: awssdk.String(bucket)})
			clients.SQS.DeleteQueue(context.Background(), &sqs.DeleteQueueInput{QueueUrl: awssdk.String(queueURL)})
		}

		deps = &TestDeps{
			DynamoTable: table, S3Bucket: bucket, SQSQueueURL: queueURL,
			Echo: e, Clients: clients, EmailMock: emailMock, Tokens: tokens,
			AberturaRepo: aberturaRepo, AlteracaoRepo: alteracaoRepo, Notificar: notificar,
		}
	})
}

// Teardown cleans up all resources created by SetupTestMain.
func Teardown() {
	if cleanupFn != nil {
		cleanupFn()
		cleanupFn = nil
	}
}

// SetupIntegration is called from individual _test.go files.
// Resources are managed by TestMain (SetupTestMain + Teardown).
func SetupIntegration(t *testing.T) *TestDeps {
	t.Helper()
	setupOnce.Do(func() { deps = setup(t) })
	return deps
}

func setup(t *testing.T) *TestDeps {
	t.Helper()
	ctx := context.Background()
	endpoint := testEndpoint()
	clients, err := infraaws.NewClients(ctx, config.AWS{
		Region:          "us-east-1",
		EndpointURL:     endpoint,
		AccessKeyID:     "test",
		SecretAccessKey: "test",
	})
	if err != nil {
		t.Fatalf("montar clients AWS: %v", err)
	}

	table := createOrReplaceDynamoTable(t, clients)
	bucket := createOrReplaceBucket(t, ctx, clients)
	queueURL := createOrReplaceQueue(t, clients)

	aberturaRepo := infraaws.NewDynamoRascunhoRepository(clients.Dynamo, table)
	alteracaoRepo := infraaws.NewDynamoRascunhoRepository(clients.Dynamo, table)
	aceiteRepo := infraaws.NewDynamoAceiteRepository(clients.Dynamo, table)
	storage := infraaws.NewS3ObjectStorage(clients.S3, bucket)
	aberturaProtocolo := infraaws.NewDynamoProtocoloCounter(clients.Dynamo, table)
	alteracaoProtocolo := infraaws.NewDynamoProtocoloCounter(clients.Dynamo, table)
	submissoes := infraaws.NewSQSSubmissaoPublisher(clients.SQS, queueURL)
	tokens := auth.NewJWTTokenService("test-secret", 30*time.Minute)
	emailMock := &MockEmailSender{}

	e := web.NewRouter(web.Deps{
		Aceite:            service.NewAceiteService(aceiteRepo, tokens),
		Sessao:            service.NewSessaoService(aberturaRepo, alteracaoRepo, tokens, storage),
		Rascunho:          service.NewRascunhoService(aberturaRepo),
		Upload:            service.NewUploadService(storage, service.PresignUploadExpiraEm),
		Submit:            service.NewSubmitService(aberturaRepo, aberturaProtocolo, submissoes, storage),
		RascunhoAlteracao: service.NewAlteracaoRascunhoService(alteracaoRepo),
		SubmitAlteracao:   service.NewAlteracaoSubmitService(alteracaoProtocolo, storage, submissoes, alteracaoRepo),
		Tokens:            tokens,
		Cookies:           auth.NewCookieBuilder(false, 30*time.Minute),
		RateLimit:         ratelimit.NewFixedWindow(100000, ratelimit.PadraoJanela),
	})

	notificar := service.NewNotificarSubmissao(aberturaRepo, storage, emailMock, "test@prolink.local")

	cleanupFn = func() {
		e.Shutdown(context.Background())
		deleteDynamoTable(context.Background(), clients, table)
		emptyBucket(context.Background(), clients, bucket)
		clients.S3.DeleteBucket(context.Background(), &s3.DeleteBucketInput{Bucket: awssdk.String(bucket)})
		clients.SQS.DeleteQueue(context.Background(), &sqs.DeleteQueueInput{QueueUrl: awssdk.String(queueURL)})
	}

	return &TestDeps{
		DynamoTable: table, S3Bucket: bucket, SQSQueueURL: queueURL,
		Echo: e, Clients: clients, EmailMock: emailMock, Tokens: tokens,
		AberturaRepo: aberturaRepo, AlteracaoRepo: alteracaoRepo, Notificar: notificar,
	}
}

func testEndpoint() string {
	if v := os.Getenv("AWS_ENDPOINT_URL"); v != "" {
		return v
	}
	return "http://localhost:4566"
}

func uniqueName(prefix string) string {
	return fmt.Sprintf("%s-%d", prefix, time.Now().UnixNano())
}

// ---- helpers with *testing.T ----

func createOrReplaceDynamoTable(t *testing.T, c *infraaws.Clients) string {
	t.Helper()
	ctx := context.Background()
	name := uniqueName("it-tbl")
	if _, err := c.Dynamo.CreateTable(ctx, &dynamodb.CreateTableInput{
		TableName: awssdk.String(name), BillingMode: ddbtypes.BillingModePayPerRequest,
		AttributeDefinitions: []ddbtypes.AttributeDefinition{
			{AttributeName: awssdk.String("sessionId"), AttributeType: ddbtypes.ScalarAttributeTypeS},
		},
		KeySchema: []ddbtypes.KeySchemaElement{
			{AttributeName: awssdk.String("sessionId"), KeyType: ddbtypes.KeyTypeHash},
		},
	}); err != nil {
		t.Fatalf("criar tabela %s: %v", name, err)
	}
	return name
}

func createOrReplaceBucket(t *testing.T, ctx context.Context, c *infraaws.Clients) string {
	t.Helper()
	name := uniqueName("it-bucket")
	if _, err := c.S3.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: awssdk.String(name)}); err != nil {
		t.Fatalf("criar bucket %s: %v", name, err)
	}
	return name
}

func createOrReplaceQueue(t *testing.T, c *infraaws.Clients) string {
	t.Helper()
	name := uniqueName("it-queue")
	out, err := c.SQS.CreateQueue(context.Background(), &sqs.CreateQueueInput{QueueName: awssdk.String(name)})
	if err != nil {
		t.Fatalf("criar fila %s: %v", name, err)
	}
	return *out.QueueUrl
}

// ---- helpers without *testing.T (for TestMain) ----

func createOrReplaceDynamoTableTM(c *infraaws.Clients) string {
	ctx := context.Background()
	name := uniqueName("it-tbl")
	if _, err := c.Dynamo.CreateTable(ctx, &dynamodb.CreateTableInput{
		TableName: awssdk.String(name), BillingMode: ddbtypes.BillingModePayPerRequest,
		AttributeDefinitions: []ddbtypes.AttributeDefinition{
			{AttributeName: awssdk.String("sessionId"), AttributeType: ddbtypes.ScalarAttributeTypeS},
		},
		KeySchema: []ddbtypes.KeySchemaElement{
			{AttributeName: awssdk.String("sessionId"), KeyType: ddbtypes.KeyTypeHash},
		},
	}); err != nil {
		panic("criar tabela " + name + ": " + err.Error())
	}
	return name
}

func createOrReplaceBucketTM(ctx context.Context, c *infraaws.Clients) string {
	name := uniqueName("it-bucket")
	if _, err := c.S3.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: awssdk.String(name)}); err != nil {
		panic("criar bucket " + name + ": " + err.Error())
	}
	return name
}

func createOrReplaceQueueTM(c *infraaws.Clients) string {
	name := uniqueName("it-queue")
	out, err := c.SQS.CreateQueue(context.Background(), &sqs.CreateQueueInput{QueueName: awssdk.String(name)})
	if err != nil {
		panic("criar fila " + name + ": " + err.Error())
	}
	return *out.QueueUrl
}

func deleteDynamoTable(ctx context.Context, c *infraaws.Clients, table string) {
	_, _ = c.Dynamo.DeleteTable(ctx, &dynamodb.DeleteTableInput{TableName: awssdk.String(table)})
}

func emptyBucket(ctx context.Context, c *infraaws.Clients, bucket string) {
	for {
		list, err := c.S3.ListObjectsV2(ctx, &s3.ListObjectsV2Input{Bucket: awssdk.String(bucket)})
		if err != nil || len(list.Contents) == 0 {
			return
		}
		ids := make([]s3types.ObjectIdentifier, 0, len(list.Contents))
		for _, obj := range list.Contents {
			ids = append(ids, s3types.ObjectIdentifier{Key: obj.Key})
		}
		_, _ = c.S3.DeleteObjects(ctx, &s3.DeleteObjectsInput{
			Bucket: awssdk.String(bucket),
			Delete: &s3types.Delete{Objects: ids},
		})
		if list.IsTruncated == nil || !*list.IsTruncated {
			return
		}
	}
}