import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import type { TipoConstituicao } from './dynamodb';

function getSqsClient() {
  return new SQSClient({
    region: process.env.AWS_REGION ?? 'us-east-1',
    ...(process.env.AWS_ENDPOINT_URL
      ? {
          endpoint: process.env.AWS_ENDPOINT_URL,
          credentials: {
            accessKeyId:     process.env.AWS_ACCESS_KEY_ID     ?? 'test',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'test',
          },
        }
      : {}),
  });
}

export type FormType = 'abertura' | 'alteracao';

export interface SubmissaoMessage {
  sessionId: string;
  protocolo: string;
  formType: FormType;
  tipo?: TipoConstituicao;
}

export async function publishSubmissao(message: SubmissaoMessage): Promise<void> {
  const client = getSqsClient();
  const queueUrl = process.env.AWS_SQS_QUEUE_URL ?? '';

  await client.send(
    new SendMessageCommand({
      QueueUrl:    queueUrl,
      MessageBody: JSON.stringify(message),
    }),
  );
}
