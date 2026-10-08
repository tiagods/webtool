//go:build integration

package testhelpers

import (
	"context"
	"fmt"
	"log"
	"os"
	"runtime"
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
	"go.uber.org/mock/gomock"

	"github.com/tiagods/webtool/apps/backend/adapter/web"
	"github.com/tiagods/webtool/apps/backend/domain/ports/outbound"
	"github.com/tiagods/webtool/apps/backend/domain/ports/outbound/mocks"
	"github.com/tiagods/webtool/apps/backend/domain/service"
	"github.com/tiagods/webtool/apps/backend/infrastructure/auth"
	infraaws "github.com/tiagods/webtool/apps/backend/infrastructure/aws"
	"github.com/tiagods/webtool/apps/backend/infrastructure/config"
	"github.com/tiagods/webtool/apps/backend/infrastructure/ratelimit"
)

const (
	// Recursos REAIS do Floci — cada repositório aponta para sua tabela.
	testAberturaTable  = "fichas-abertura"
	testAlteracaoTable = "fichas-alteracao"
	testAceiteTable    = "prolink-aceites-lgpd"
	testBucket         = "prolink-fichas"
)

// mainReporter implementa gomock.TestReporter para o mock de notificação
// criado no SetupTestMain — que roda no TestMain, antes de existir qualquer
// *testing.T. Fatalf derruba o binário de teste (Goexit), como a stdlib faz.
type mainReporter struct{}

func (mainReporter) Errorf(format string, args ...any) {
	log.Printf("gomock: "+format, args...)
}

func (mainReporter) Fatalf(format string, args ...any) {
	log.Printf("gomock: "+format, args...)
	runtime.Goexit()
}

type TestDeps struct {
	DynamoTable   string
	S3Bucket      string
	SQSQueueURL   string
	Echo          *echo.Echo
	Clients       *infraaws.Clients
	Notificacoes  *mocks.MockNotificacaoSender
	Tokens        outbound.TokenService
	AberturaRepo  *infraaws.DynamoRascunhoRepository
	AlteracaoRepo *infraaws.DynamoRascunhoRepository
	Notificar     *service.NotificarSubmissao
}

var (
	setupTestMainOnce sync.Once
	deps              *TestDeps
	testQueueURL      string // URL real da fila SQS (nome único por execução)
)

// ─── SetupTestMain ───────────────────────────────────────────────────────────
// Cria recursos AWS compartilhados (nomes fixos) UMA vez.
// Teardown os deleta após todos os testes.
func SetupTestMain() {
	setupTestMainOnce.Do(func() {
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

		// Recria tabelas "sessionId" (PK) — fichas-abertura e fichas-alteracao
		createOrReplaceDynamoTableFixed(ctx, clients, testAberturaTable)
		createOrReplaceDynamoTableFixed(ctx, clients, testAlteracaoTable)
		// prolink-aceites-lgpd NÃO é recriada (schema PK+SK diferente)
		createOrReplaceBucketFixed(ctx, clients)
		createOrReplaceQueueFixed(ctx, clients)

		queueURL := testQueueURL

		aberturaRepo := infraaws.NewDynamoRascunhoRepository(clients.Dynamo, testAberturaTable)
		alteracaoRepo := infraaws.NewDynamoRascunhoRepository(clients.Dynamo, testAlteracaoTable)
		aceiteRepo := infraaws.NewDynamoAceiteRepository(clients.Dynamo, testAceiteTable)
		storage := infraaws.NewS3ObjectStorage(clients.S3, testBucket)
		aberturaProtocolo := infraaws.NewDynamoProtocoloCounter(clients.Dynamo, testAberturaTable)
		alteracaoProtocolo := infraaws.NewDynamoProtocoloCounter(clients.Dynamo, testAlteracaoTable)
		submissoes := infraaws.NewSQSSubmissaoPublisher(clients.SQS, queueURL)
		tokens := auth.NewJWTTokenService("test-secret", 30*time.Minute)
		notificacoes := mocks.NewMockNotificacaoSender(gomock.NewController(mainReporter{}))

		e := web.NewRouter(web.Deps{
			Aceite:            service.NewAceiteService(aceiteRepo, tokens),
			Sessao:            service.NewSessaoService(aberturaRepo, alteracaoRepo, tokens, storage),
			Rascunho:          service.NewRascunhoService(aberturaRepo),
			Upload:            service.NewUploadService(storage, aberturaRepo, service.PresignUploadExpiraEm),
			Submit:            service.NewSubmitService(aberturaRepo, aberturaProtocolo, submissoes, storage),
			RascunhoAlteracao: service.NewAlteracaoRascunhoService(alteracaoRepo),
			SubmitAlteracao:   service.NewAlteracaoSubmitService(alteracaoProtocolo, storage, submissoes, alteracaoRepo),
			Tokens:            tokens,
			Cookies:           auth.NewCookieBuilder(false, 30*time.Minute),
			RateLimit:         ratelimit.NewFixedWindow(100000, ratelimit.PadraoJanela),
		})

		notificar := service.NewNotificarSubmissao(aberturaRepo, storage, notificacoes)

		deps = &TestDeps{
			DynamoTable: testAberturaTable, S3Bucket: testBucket, SQSQueueURL: queueURL,
			Echo: e, Clients: clients, Notificacoes: notificacoes, Tokens: tokens,
			AberturaRepo: aberturaRepo, AlteracaoRepo: alteracaoRepo, Notificar: notificar,
		}
	})
}

func Teardown() {}

// ─── SetupIntegration ────────────────────────────────────────────────────────
// Retorna os deps compartilhados (criados por SetupTestMain).
// Cada teste usa os MESMOS recursos — sem criação aleatória por teste.
func SetupIntegration(t *testing.T) *TestDeps {
	t.Helper()
	if deps == nil {
		t.Fatal("SetupIntegration: SetupTestMain nao foi chamado. Use 'go test -tags integration' com TestMain ou chame SetupTestMain primeiro.")
	}
	return deps
}

// ─── Helpers de criação com nomes FIXOS ─────────────────────────────────────

func createOrReplaceDynamoTableFixed(ctx context.Context, c *infraaws.Clients, tableName string) {
	_, _ = c.Dynamo.DeleteTable(ctx, &dynamodb.DeleteTableInput{TableName: awssdk.String(tableName)})
	_, err := c.Dynamo.CreateTable(ctx, &dynamodb.CreateTableInput{
		TableName: awssdk.String(tableName), BillingMode: ddbtypes.BillingModePayPerRequest,
		AttributeDefinitions: []ddbtypes.AttributeDefinition{
			{AttributeName: awssdk.String("sessionId"), AttributeType: ddbtypes.ScalarAttributeTypeS},
		},
		KeySchema: []ddbtypes.KeySchemaElement{
			{AttributeName: awssdk.String("sessionId"), KeyType: ddbtypes.KeyTypeHash},
		},
	})
	if err != nil {
		panic("criar tabela " + tableName + ": " + err.Error())
	}
	// Habilita TTL no atributo "ttl" (igual ao init.sh das tabelas reais)
	_, _ = c.Dynamo.UpdateTimeToLive(ctx, &dynamodb.UpdateTimeToLiveInput{
		TableName: awssdk.String(tableName),
		TimeToLiveSpecification: &ddbtypes.TimeToLiveSpecification{
			Enabled:       awssdk.Bool(true),
			AttributeName: awssdk.String("ttl"),
		},
	})
}

func createOrReplaceBucketFixed(ctx context.Context, c *infraaws.Clients) {
	emptyBucket(ctx, c, testBucket)
	_, _ = c.S3.DeleteBucket(ctx, &s3.DeleteBucketInput{Bucket: awssdk.String(testBucket)})
	_, err := c.S3.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: awssdk.String(testBucket)})
	if err != nil {
		panic("criar bucket " + testBucket + ": " + err.Error())
	}
}

func createOrReplaceQueueFixed(ctx context.Context, c *infraaws.Clients) {
	// Nome único por execução para não contaminar outros testes via SQS
	name := fmt.Sprintf("it-queue-%d", time.Now().UnixNano())
	out, err := c.SQS.CreateQueue(ctx, &sqs.CreateQueueInput{QueueName: awssdk.String(name)})
	if err != nil {
		panic("criar fila " + name + ": " + err.Error())
	}
	testQueueURL = *out.QueueUrl
}

// ─── Helpers de criação com nomes ÚNICOS (mantidos para compatibilidade) ─────

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

// ─── Utilitários ─────────────────────────────────────────────────────────────

func testEndpoint() string {
	if v := os.Getenv("AWS_ENDPOINT_URL"); v != "" {
		return v
	}
	return "http://localhost:4566"
}

func uniqueName(prefix string) string {
	return fmt.Sprintf("%s-%d", prefix, time.Now().UnixNano())
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
