//go:build integration

package aws

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	awssdk "github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

func TestS3ObjectStorage_PresignPutJSONCopyDelete(t *testing.T) {
	c := testClients(t)
	bucket := createBucket(t, c)
	store := NewS3ObjectStorage(c.S3, bucket)
	ctx := context.Background()

	const origem = "sess-abc/contratoSocial.pdf"

	// Presign PUT + upload real via HTTP.
	url, err := store.PresignedUploadURL(ctx, origem, "application/pdf", 300*time.Second)
	if err != nil {
		t.Fatalf("PresignedUploadURL: %v", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, url, strings.NewReader("%PDF-1.4 conteudo de teste"))
	if err != nil {
		t.Fatalf("montar request: %v", err)
	}
	req.Header.Set("Content-Type", "application/pdf")
	req.Header.Set("x-amz-tagging", rascunhoRetentionTag)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("PUT presign: %v", err)
	}
	body, _ := io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("PUT presign status %d: %s", resp.StatusCode, body)
	}

	// O objeto de rascunho nasce com a tag de retenção.
	if tags := objectTags(t, c, bucket, origem); tags["retention"] != "rascunho" {
		t.Fatalf("tags da origem = %v, esperava retention=rascunho", tags)
	}

	// PutJSON grava direto.
	if err := store.PutJSON(ctx, "sess-abc/backup.json", map[string]any{"protocolo": "PRO-1", "ok": true}); err != nil {
		t.Fatalf("PutJSON: %v", err)
	}

	// Copy para a pasta do protocolo remove as tags no destino.
	const destino = "protocolos/PRO-1/contratoSocial.pdf"
	if err := store.Copy(ctx, origem, destino); err != nil {
		t.Fatalf("Copy: %v", err)
	}
	if tags := objectTags(t, c, bucket, destino); len(tags) != 0 {
		t.Fatalf("destino deveria estar sem tags, veio %v", tags)
	}
	if tags := objectTags(t, c, bucket, origem); tags["retention"] != "rascunho" {
		t.Fatalf("origem não deveria perder a tag, veio %v", tags)
	}

	// DeletePrefix esvazia a pasta da sessão.
	if err := store.DeletePrefix(ctx, "sess-abc/"); err != nil {
		t.Fatalf("DeletePrefix: %v", err)
	}
	list, err := c.S3.ListObjectsV2(ctx, &s3.ListObjectsV2Input{
		Bucket: awssdk.String(bucket),
		Prefix: awssdk.String("sess-abc/"),
	})
	if err != nil {
		t.Fatalf("ListObjectsV2: %v", err)
	}
	if len(list.Contents) != 0 {
		t.Fatalf("prefixo da sessão não esvaziado: %d objeto(s)", len(list.Contents))
	}

	// DeletePrefix num prefixo vazio é no-op.
	if err := store.DeletePrefix(ctx, "prefixo/inexistente/"); err != nil {
		t.Fatalf("DeletePrefix (vazio): %v", err)
	}

	// O objeto do protocolo continua lá.
	if _, err := c.S3.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: awssdk.String(bucket),
		Key:    awssdk.String(destino),
	}); err != nil {
		t.Fatalf("objeto do protocolo sumiu: %v", err)
	}
}

func objectTags(t *testing.T, c *Clients, bucket, key string) map[string]string {
	t.Helper()
	out, err := c.S3.GetObjectTagging(context.Background(), &s3.GetObjectTaggingInput{
		Bucket: awssdk.String(bucket),
		Key:    awssdk.String(key),
	})
	if err != nil {
		t.Fatalf("GetObjectTagging(%s): %v", key, err)
	}
	tags := make(map[string]string, len(out.TagSet))
	for _, tag := range out.TagSet {
		tags[*tag.Key] = *tag.Value
	}
	return tags
}
