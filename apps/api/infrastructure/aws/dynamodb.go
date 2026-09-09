package aws

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	awssdk "github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/expression"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	"github.com/tiagods/webtool/apps/api/domain/entity"
	"github.com/tiagods/webtool/apps/api/domain/ports/outbound"
	"github.com/tiagods/webtool/apps/api/infrastructure/aws/model"
)

// Janelas de retenção gravadas no atributo `ttl` (epoch-seconds). Espelham as
// constantes de apps/api/lib/aws/dynamodb.ts (anos sem ajuste de bissexto).
const (
	ttlRascunho = 2 * time.Hour
	ttlEnviado  = 30 * 24 * time.Hour
	ttlAceite   = 5 * 365 * 24 * time.Hour
)

// counterSessionID é a chave do item de controle do contador de protocolo,
// próprio de cada tabela e sem TTL.
const counterSessionID = "COUNTER"

// sessionKey monta a chave primária de um item por sessionId.
func sessionKey(sessionID string) map[string]types.AttributeValue {
	return map[string]types.AttributeValue{
		"sessionId": &types.AttributeValueMemberS{Value: sessionID},
	}
}

func nowISO() string {
	return time.Now().UTC().Format(time.RFC3339Nano)
}

// DynamoRascunhoRepository implementa outbound.RascunhoRepository sobre uma única
// tabela DynamoDB (abertura ou alteração — fixada na construção).
type DynamoRascunhoRepository struct {
	client *dynamodb.Client
	table  string
}

var _ outbound.RascunhoRepository = (*DynamoRascunhoRepository)(nil)

// NewDynamoRascunhoRepository liga o repositório a um client e a uma tabela.
func NewDynamoRascunhoRepository(client *dynamodb.Client, table string) *DynamoRascunhoRepository {
	return &DynamoRascunhoRepository{client: client, table: table}
}

// Get devolve o rascunho da sessão, ou (nil, nil) se o item não existir.
func (r *DynamoRascunhoRepository) Get(ctx context.Context, sessionID string) (*entity.Rascunho, error) {
	out, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: awssdk.String(r.table),
		Key:       sessionKey(sessionID),
	})
	if err != nil {
		return nil, fmt.Errorf("buscar rascunho: %w", err)
	}
	if out.Item == nil {
		return nil, nil
	}

	var item model.RascunhoItem
	if err := attributevalue.UnmarshalMap(out.Item, &item); err != nil {
		return nil, fmt.Errorf("decodificar rascunho: %w", err)
	}
	return item.ToEntity()
}

// EnsureInicial cria o item de rascunho de forma idempotente (todos os campos via
// if_not_exists) — seguro chamar a cada sessão nova.
func (r *DynamoRascunhoRepository) EnsureInicial(ctx context.Context, sessionID string) error {
	now := time.Now().UTC()
	iso := now.Format(time.RFC3339Nano)
	ttl := now.Add(ttlRascunho).Unix()
	empty := map[string]string{}

	upd := expression.
		Set(expression.Name("status"), expression.IfNotExists(expression.Name("status"), expression.Value(string(entity.StatusRascunho)))).
		Set(expression.Name("createdAt"), expression.IfNotExists(expression.Name("createdAt"), expression.Value(iso))).
		Set(expression.Name("updatedAt"), expression.IfNotExists(expression.Name("updatedAt"), expression.Value(iso))).
		Set(expression.Name("ttl"), expression.IfNotExists(expression.Name("ttl"), expression.Value(ttl))).
		Set(expression.Name("documentosKeys"), expression.IfNotExists(expression.Name("documentosKeys"), expression.Value(empty))).
		Set(expression.Name("payload"), expression.IfNotExists(expression.Name("payload"), expression.Value(empty)))

	return r.update(ctx, sessionID, upd)
}

// PutPayload grava o payload validado, renova o TTL para 2h e não altera o
// status. tipo vazio deixa o campo denormalizado intacto.
func (r *DynamoRascunhoRepository) PutPayload(ctx context.Context, sessionID string, payload json.RawMessage, tipo entity.TipoConstituicao) error {
	var payloadMap map[string]any
	if err := json.Unmarshal(payload, &payloadMap); err != nil {
		return fmt.Errorf("decodificar payload do rascunho: %w", err)
	}

	now := time.Now().UTC()
	upd := expression.
		Set(expression.Name("payload"), expression.Value(payloadMap)).
		Set(expression.Name("updatedAt"), expression.Value(now.Format(time.RFC3339Nano))).
		Set(expression.Name("ttl"), expression.Value(now.Add(ttlRascunho).Unix()))
	if tipo != "" {
		upd = upd.Set(expression.Name("tipo"), expression.Value(string(tipo)))
	}

	return r.update(ctx, sessionID, upd)
}

// PutDocumentoKey mescla uma key S3 confirmada no mapa documentosKeys. campo é um
// nome de campo controlado pelo endpoint de upload (whitelist), não entrada livre.
func (r *DynamoRascunhoRepository) PutDocumentoKey(ctx context.Context, sessionID, campo, key string) error {
	upd := expression.
		Set(expression.Name("documentosKeys."+campo), expression.Value(key)).
		Set(expression.Name("updatedAt"), expression.Value(nowISO()))

	return r.update(ctx, sessionID, upd)
}

// MarcarEnviado transiciona o status para enviado e, no mesmo UpdateItem, zera
// payload e documentosKeys (defesa em profundidade LGPD) e move o TTL para 30d.
func (r *DynamoRascunhoRepository) MarcarEnviado(ctx context.Context, sessionID, protocolo string, tipo entity.TipoConstituicao) error {
	now := time.Now().UTC()
	upd := expression.
		Set(expression.Name("status"), expression.Value(string(entity.StatusEnviado))).
		Set(expression.Name("protocolo"), expression.Value(protocolo)).
		Set(expression.Name("tipo"), expression.Value(string(tipo))).
		Set(expression.Name("payload"), expression.Value(nil)).
		Set(expression.Name("documentosKeys"), expression.Value(nil)).
		Set(expression.Name("updatedAt"), expression.Value(now.Format(time.RFC3339Nano))).
		Set(expression.Name("ttl"), expression.Value(now.Add(ttlEnviado).Unix()))

	return r.update(ctx, sessionID, upd)
}

// Delete apaga o item de rascunho (exclusão sob solicitação, LGPD Art. 18).
func (r *DynamoRascunhoRepository) Delete(ctx context.Context, sessionID string) error {
	_, err := r.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: awssdk.String(r.table),
		Key:       sessionKey(sessionID),
	})
	if err != nil {
		return fmt.Errorf("apagar rascunho: %w", err)
	}
	return nil
}

// update compila e aplica um UpdateItem sobre a chave da sessão.
func (r *DynamoRascunhoRepository) update(ctx context.Context, sessionID string, upd expression.UpdateBuilder) error {
	expr, err := expression.NewBuilder().WithUpdate(upd).Build()
	if err != nil {
		return fmt.Errorf("montar expressão de update: %w", err)
	}

	_, err = r.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName:                 awssdk.String(r.table),
		Key:                       sessionKey(sessionID),
		UpdateExpression:          expr.Update(),
		ExpressionAttributeNames:  expr.Names(),
		ExpressionAttributeValues: expr.Values(),
	})
	if err != nil {
		return fmt.Errorf("atualizar rascunho: %w", err)
	}
	return nil
}

// DynamoAceiteRepository implementa outbound.AceiteRepository.
type DynamoAceiteRepository struct {
	client *dynamodb.Client
	table  string
}

var _ outbound.AceiteRepository = (*DynamoAceiteRepository)(nil)

// NewDynamoAceiteRepository liga o repositório a um client e à tabela de aceites.
func NewDynamoAceiteRepository(client *dynamodb.Client, table string) *DynamoAceiteRepository {
	return &DynamoAceiteRepository{client: client, table: table}
}

// Put grava o registro com TTL de 5 anos calculado a partir de AceitoEm.
func (r *DynamoAceiteRepository) Put(ctx context.Context, registro entity.RegistroAceite) error {
	dto, err := model.AceiteItemFromEntity(registro, ttlAceite)
	if err != nil {
		return err
	}

	item, err := attributevalue.MarshalMap(dto)
	if err != nil {
		return fmt.Errorf("codificar registro de aceite: %w", err)
	}

	if _, err := r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: awssdk.String(r.table),
		Item:      item,
	}); err != nil {
		return fmt.Errorf("gravar registro de aceite: %w", err)
	}
	return nil
}

// DynamoProtocoloCounter implementa outbound.ProtocoloCounter via um contador
// atômico (ADD seq) no item de controle COUNTER da tabela.
type DynamoProtocoloCounter struct {
	client *dynamodb.Client
	table  string
}

var _ outbound.ProtocoloCounter = (*DynamoProtocoloCounter)(nil)

// NewDynamoProtocoloCounter liga o contador a um client e a uma tabela.
func NewDynamoProtocoloCounter(client *dynamodb.Client, table string) *DynamoProtocoloCounter {
	return &DynamoProtocoloCounter{client: client, table: table}
}

// Proximo incrementa o contador e devolve {prefix}{ano UTC}-{seq 6 dígitos}.
func (c *DynamoProtocoloCounter) Proximo(ctx context.Context, prefix string) (string, error) {
	out, err := c.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName:                 awssdk.String(c.table),
		Key:                       sessionKey(counterSessionID),
		UpdateExpression:          awssdk.String("ADD seq :inc"),
		ExpressionAttributeValues: map[string]types.AttributeValue{":inc": &types.AttributeValueMemberN{Value: "1"}},
		ReturnValues:              types.ReturnValueUpdatedNew,
	})
	if err != nil {
		return "", fmt.Errorf("incrementar contador de protocolo: %w", err)
	}

	var attrs struct {
		Seq int64 `dynamodbav:"seq"`
	}
	if err := attributevalue.UnmarshalMap(out.Attributes, &attrs); err != nil {
		return "", fmt.Errorf("decodificar contador de protocolo: %w", err)
	}

	ano := time.Now().UTC().Year()
	return fmt.Sprintf("%s%d-%06d", prefix, ano, attrs.Seq), nil
}
