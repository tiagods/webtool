import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import type { RegistroAceite, AberturaFormValues } from '@prolink/shared';

const CINCO_ANOS_EM_SEGUNDOS = 5 * 365 * 24 * 60 * 60;
const DUAS_HORAS_EM_SEGUNDOS = 2 * 60 * 60;
const TRINTA_DIAS_EM_SEGUNDOS = 30 * 24 * 60 * 60;

export type TipoConstituicao = 'ltda' | 'slu';
export type RascunhoStatus = 'rascunho' | 'enviado';

export interface RascunhoItem<TPayload = AberturaFormValues> {
  sessionId: string;
  tipo?: TipoConstituicao;
  status: RascunhoStatus;
  protocolo?: string;
  createdAt: string;
  updatedAt: string;
  ttl: number;
  documentosKeys: Record<string, string> | null;
  payload: Partial<TPayload> | null;
}

function getDynamoClient() {
  const client = new DynamoDBClient({
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

  return DynamoDBDocumentClient.from(client);
}

function getRascunhosTableName(): string {
  return process.env.AWS_DYNAMODB_TABLE ?? 'fichas-abertura';
}

/** Tabela própria da Ficha de Alteração Contratual (Spec 012) — mesmo desenho de item, tabela separada. */
export function getAlteracaoTableName(): string {
  return process.env.AWS_DYNAMODB_ALTERACAO_TABLE ?? 'fichas-alteracao';
}

export async function putRegistroAceite(registro: RegistroAceite): Promise<void> {
  const client = getDynamoClient();
  const tableName = process.env.AWS_DYNAMODB_ACEITES_TABLE ?? 'prolink-aceites-lgpd';
  const ttl = Math.floor(new Date(registro.aceitoEm).getTime() / 1000) + CINCO_ANOS_EM_SEGUNDOS;

  await client.send(
    new PutCommand({
      TableName: tableName,
      Item: { ...registro, ttl },
    }),
  );
}

/**
 * Cria o item de rascunho na primeira vez que uma sessão é gerada (bootstrap).
 * Idempotente via if_not_exists — seguro chamar sempre que uma sessão nova é criada.
 */
export async function ensureRascunhoInicial(
  sessionId: string,
  tableName: string = getRascunhosTableName(),
): Promise<void> {
  const client = getDynamoClient();
  const nowIso = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + DUAS_HORAS_EM_SEGUNDOS;

  await client.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { sessionId },
      UpdateExpression:
        'SET #s = if_not_exists(#s, :rascunho), ' +
        'createdAt = if_not_exists(createdAt, :now), ' +
        'updatedAt = if_not_exists(updatedAt, :now), ' +
        '#ttl = if_not_exists(#ttl, :ttl), ' +
        'documentosKeys = if_not_exists(documentosKeys, :emptyMap), ' +
        'payload = if_not_exists(payload, :emptyMap)',
      ExpressionAttributeNames: { '#s': 'status', '#ttl': 'ttl' },
      ExpressionAttributeValues: {
        ':rascunho': 'rascunho',
        ':now': nowIso,
        ':ttl': ttl,
        ':emptyMap': {},
      },
    }),
  );
}

/**
 * Apaga o item de rascunho/sessão (exclusão sob solicitação, LGPD Art. 18). Chamador
 * é responsável por já ter garantido que a sessão não está com status 'enviado'.
 */
export async function deleteDraft(
  sessionId: string,
  tableName: string = getRascunhosTableName(),
): Promise<void> {
  const client = getDynamoClient();

  await client.send(
    new DeleteCommand({
      TableName: tableName,
      Key: { sessionId },
    }),
  );
}

export async function getRascunho<TPayload = AberturaFormValues>(
  sessionId: string,
  tableName: string = getRascunhosTableName(),
): Promise<RascunhoItem<TPayload> | null> {
  const client = getDynamoClient();
  const res = await client.send(
    new GetCommand({
      TableName: tableName,
      Key: { sessionId },
    }),
  );

  return (res.Item as RascunhoItem<TPayload> | undefined) ?? null;
}

/**
 * Salva o payload validado do formulário no rascunho. Não altera `status` (permanece
 * 'rascunho' — a transição para 'enviado' é responsabilidade exclusiva de marcarEnviado).
 * Renova o TTL para 2h a cada save.
 */
export async function putRascunho<TPayload = AberturaFormValues>(
  sessionId: string,
  payload: Partial<TPayload>,
  tableName: string = getRascunhosTableName(),
): Promise<void> {
  const client = getDynamoClient();
  const ttl = Math.floor(Date.now() / 1000) + DUAS_HORAS_EM_SEGUNDOS;
  // `tipo` é denormalizado no item para os dois formulários — cada um guarda o campo
  // tipoConstituicao em um caminho diferente do payload (Abertura: dadosEmpresa.tipoConstituicao;
  // Alteração: identificacao.tipoConstituicao). Ambos usam o mesmo enum ('ltda'|'slu').
  const payloadUnknown = payload as { dadosEmpresa?: { tipoConstituicao?: TipoConstituicao }; identificacao?: { tipoConstituicao?: TipoConstituicao } };
  const tipo = payloadUnknown.dadosEmpresa?.tipoConstituicao ?? payloadUnknown.identificacao?.tipoConstituicao;

  await client.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { sessionId },
      UpdateExpression:
        'SET payload = :payload, updatedAt = :now, #ttl = :ttl' + (tipo ? ', tipo = :tipo' : ''),
      ExpressionAttributeNames: { '#ttl': 'ttl' },
      ExpressionAttributeValues: {
        ':payload': payload,
        ':now': new Date().toISOString(),
        ':ttl': ttl,
        ...(tipo ? { ':tipo': tipo } : {}),
      },
    }),
  );
}

/**
 * Persiste a key S3 de um documento confirmado como upload (merge — não afeta os demais campos).
 * Assume que `documentosKeys` já existe como map (garantido por ensureRascunhoInicial).
 */
export async function putDocumentoKey(sessionId: string, campo: string, key: string): Promise<void> {
  const client = getDynamoClient();

  await client.send(
    new UpdateCommand({
      TableName: getRascunhosTableName(),
      Key: { sessionId },
      UpdateExpression: 'SET documentosKeys.#campo = :key, updatedAt = :now',
      ExpressionAttributeNames: { '#campo': campo },
      ExpressionAttributeValues: { ':key': key, ':now': new Date().toISOString() },
    }),
  );
}

/**
 * Marca a sessão como enviada — zera payload e documentosKeys no mesmo UpdateItem
 * (nunca há uma janela em que dados sensíveis coexistem com status 'enviado') e
 * redefine o TTL para 30 dias.
 */
export async function marcarEnviado(
  sessionId: string,
  protocolo: string,
  tipo: TipoConstituicao,
  tableName: string = getRascunhosTableName(),
): Promise<void> {
  const client = getDynamoClient();
  const ttl = Math.floor(Date.now() / 1000) + TRINTA_DIAS_EM_SEGUNDOS;

  await client.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { sessionId },
      UpdateExpression:
        'SET #s = :enviado, protocolo = :protocolo, tipo = :tipo, payload = :null, documentosKeys = :null, ' +
        'updatedAt = :now, #ttl = :ttl',
      ExpressionAttributeNames: { '#s': 'status', '#ttl': 'ttl' },
      ExpressionAttributeValues: {
        ':enviado': 'enviado',
        ':protocolo': protocolo,
        ':tipo': tipo,
        ':null': null,
        ':now': new Date().toISOString(),
        ':ttl': ttl,
      },
    }),
  );
}

/**
 * Gera o próximo protocolo sequencial ({prefix}{ano UTC}-{seq 6 dígitos}) via contador
 * acumulativo no item de controle "COUNTER" (sem TTL) — próprio de cada tabela.
 */
export async function proximoProtocolo(
  prefix = 'PRO-',
  tableName: string = getRascunhosTableName(),
): Promise<string> {
  const client = getDynamoClient();
  const ano = new Date().getUTCFullYear();

  const res = await client.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { sessionId: 'COUNTER' },
      UpdateExpression: 'ADD seq :inc',
      ExpressionAttributeValues: { ':inc': 1 },
      ReturnValues: 'UPDATED_NEW',
    }),
  );

  const seq = Number(res.Attributes?.seq ?? 0);
  return `${prefix}${ano}-${String(seq).padStart(6, '0')}`;
}
