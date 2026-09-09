package aws

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"time"

	awssdk "github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"

	"github.com/tiagods/webtool/apps/backend/domain/ports/outbound"
)

// rascunhoRetentionTag marca objetos de rascunho ainda não finalizados. A
// Lifecycle Rule do bucket filtra por essa tag para expirar sessões abandonadas;
// Copy remove a tag ao mover o objeto para a pasta do protocolo.
const rascunhoRetentionTag = "retention=rascunho"

// S3ObjectStorage implementa outbound.DocumentoStorage sobre um bucket S3.
type S3ObjectStorage struct {
	client  *s3.Client
	presign *s3.PresignClient
	bucket  string
}

var _ outbound.DocumentoStorage = (*S3ObjectStorage)(nil)

// NewS3ObjectStorage liga o storage a um client e a um bucket, derivando o
// presign client do mesmo client.
func NewS3ObjectStorage(client *s3.Client, bucket string) *S3ObjectStorage {
	return &S3ObjectStorage{
		client:  client,
		presign: s3.NewPresignClient(client),
		bucket:  bucket,
	}
}

// PresignedUploadURL assina uma URL PUT válida por expiresIn, já com a tag de
// retenção de rascunho aplicada ao objeto.
func (s *S3ObjectStorage) PresignedUploadURL(ctx context.Context, key, contentType string, expiresIn time.Duration) (string, error) {
	req, err := s.presign.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:      awssdk.String(s.bucket),
		Key:         awssdk.String(key),
		ContentType: awssdk.String(contentType),
		Tagging:     awssdk.String(rascunhoRetentionTag),
	}, s3.WithPresignExpires(expiresIn))
	if err != nil {
		return "", fmt.Errorf("assinar URL de upload: %w", err)
	}
	return req.URL, nil
}

// PutJSON grava data serializado como application/json na key indicada.
func (s *S3ObjectStorage) PutJSON(ctx context.Context, key string, data any) error {
	body, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("serializar objeto JSON: %w", err)
	}

	if _, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      awssdk.String(s.bucket),
		Key:         awssdk.String(key),
		Body:        bytes.NewReader(body),
		ContentType: awssdk.String("application/json"),
	}); err != nil {
		return fmt.Errorf("gravar objeto JSON: %w", err)
	}
	return nil
}

// Copy copia srcKey para destKey removendo todas as tags do objeto de destino
// (deixa de ser alcançável pela Lifecycle Rule de expiração). As keys são
// caminhos internos controlados ({sessionId}/... e protocolos/...), sem
// necessidade de URL-encoding do CopySource.
func (s *S3ObjectStorage) Copy(ctx context.Context, srcKey, destKey string) error {
	if _, err := s.client.CopyObject(ctx, &s3.CopyObjectInput{
		Bucket:           awssdk.String(s.bucket),
		CopySource:       awssdk.String(s.bucket + "/" + srcKey),
		Key:              awssdk.String(destKey),
		TaggingDirective: types.TaggingDirectiveReplace,
		Tagging:          awssdk.String(""),
	}); err != nil {
		return fmt.Errorf("copiar objeto: %w", err)
	}
	return nil
}

// DeletePrefix apaga todos os objetos sob prefix. Assume < 1000 objetos (uma
// única página de ListObjectsV2) — suficiente para os documentos de um formulário.
func (s *S3ObjectStorage) DeletePrefix(ctx context.Context, prefix string) error {
	listed, err := s.client.ListObjectsV2(ctx, &s3.ListObjectsV2Input{
		Bucket: awssdk.String(s.bucket),
		Prefix: awssdk.String(prefix),
	})
	if err != nil {
		return fmt.Errorf("listar objetos por prefixo: %w", err)
	}
	if len(listed.Contents) == 0 {
		return nil
	}

	ids := make([]types.ObjectIdentifier, 0, len(listed.Contents))
	for _, obj := range listed.Contents {
		if obj.Key != nil {
			ids = append(ids, types.ObjectIdentifier{Key: obj.Key})
		}
	}

	if _, err := s.client.DeleteObjects(ctx, &s3.DeleteObjectsInput{
		Bucket: awssdk.String(s.bucket),
		Delete: &types.Delete{Objects: ids},
	}); err != nil {
		return fmt.Errorf("apagar objetos por prefixo: %w", err)
	}
	return nil
}
