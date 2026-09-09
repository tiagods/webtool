import {
  S3Client,
  PutObjectCommand,
  CopyObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const ALLOWED_CONTENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

const CONTENT_TYPE_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg':      'jpg',
  'image/png':       'png',
};

function getS3Client() {
  return new S3Client({
    region: process.env.AWS_REGION ?? 'us-east-1',
    ...(process.env.AWS_ENDPOINT_URL
      ? {
          endpoint: process.env.AWS_ENDPOINT_URL,
          forcePathStyle: true,
          credentials: {
            accessKeyId:     process.env.AWS_ACCESS_KEY_ID     ?? 'test',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'test',
          },
        }
      : {}),
  });
}

export function getExtension(contentType: string): string {
  return CONTENT_TYPE_EXT[contentType] ?? 'bin';
}

export function isAllowedContentType(contentType: string): boolean {
  return ALLOWED_CONTENT_TYPES.includes(contentType);
}

// Tag aplicada a todo objeto de rascunho (ainda não finalizado) — a Lifecycle Rule do
// bucket (infra/local/init.sh) filtra por essa tag para expirar em 30 dias apenas
// sessões abandonadas. Objetos copiados para protocolos/ têm a tag removida no copyObject
// abaixo, então nunca são alcançados por essa regra (ver Notas do critério "Lifecycle Rule").
const RASCUNHO_RETENTION_TAG = 'retention=rascunho';

export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 300,
): Promise<string> {
  const client = getS3Client();
  const bucket = process.env.AWS_S3_BUCKET ?? 'prolink-fichas';

  const command = new PutObjectCommand({
    Bucket:      bucket,
    Key:         key,
    ContentType: contentType,
    Tagging:     RASCUNHO_RETENTION_TAG,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Grava um objeto JSON diretamente (sem presigned URL) — usado no backup do payload
 * validado de formulários sem upload de arquivos (ex.: submit da Ficha de Alteração).
 */
export async function putJsonObject(key: string, data: unknown): Promise<void> {
  const client = getS3Client();
  const bucket = process.env.AWS_S3_BUCKET ?? 'prolink-fichas';

  await client.send(
    new PutObjectCommand({
      Bucket:      bucket,
      Key:         key,
      Body:        JSON.stringify(data),
      ContentType: 'application/json',
    }),
  );
}

export async function copyObject(sourceKey: string, destKey: string): Promise<void> {
  const client = getS3Client();
  const bucket = process.env.AWS_S3_BUCKET ?? 'prolink-fichas';

  await client.send(
    new CopyObjectCommand({
      Bucket:           bucket,
      CopySource:       `${bucket}/${sourceKey}`,
      Key:              destKey,
      TaggingDirective: 'REPLACE',
      Tagging:          '',
    }),
  );
}

/**
 * Lista e deleta todos os objetos sob um prefixo (usado para limpar {sessionId}/
 * imediatamente após o submit, uma vez que os docs já foram copiados para protocolos/{protocolo}/).
 * Assume < 1000 objetos por sessão (suficiente para os documentos de um formulário).
 */
export async function deleteObjectsWithPrefix(prefix: string): Promise<void> {
  const client = getS3Client();
  const bucket = process.env.AWS_S3_BUCKET ?? 'prolink-fichas';

  const listed = await client.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }),
  );

  const keys = (listed.Contents ?? []).flatMap((obj) => (obj.Key ? [{ Key: obj.Key }] : []));
  if (keys.length === 0) return;

  await client.send(
    new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: keys },
    }),
  );
}
