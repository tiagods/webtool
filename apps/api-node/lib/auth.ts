import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { randomUUID } from 'crypto';
import { getRascunho, ensureRascunhoInicial } from '@/lib/aws/dynamodb';
import { TERMO_VERSAO_ATUAL } from '@prolink/shared';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'dev-secret-change-in-production'
);

const ACEITE_COOKIE = 'prolink_aceite';
const SESSION_COOKIE = 'prolink_session';
const SESSION_EXPIRY = parseInt(process.env.SESSION_EXPIRY_SECONDS ?? '7200', 10);

/** Verifica se a requisição tem um cookie prolink_aceite válido para a versão atual do termo (Spec 007). */
export async function requireAceite(cookieStore: Awaited<ReturnType<typeof cookies>>): Promise<boolean> {
  const token = cookieStore.get(ACEITE_COOKIE)?.value;
  if (!token) return false;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload.versaoTermo === TERMO_VERSAO_ATUAL;
  } catch {
    return false;
  }
}

export interface SessionResult {
  sessionId: string;
  token: string;
  isNew: boolean;
}

/**
 * Lê o cookie prolink_session existente ou cria uma sessão nova (JWT + bootstrap do
 * item de rascunho no DynamoDB). Único ponto que assina/verifica o JWT de sessão —
 * reusado por POST /api/session, POST /api/upload-url e POST /api/alteracao/session.
 *
 * `tableName` — tabela onde o item inicial de rascunho é criado para sessões novas
 * (default: Abertura). As rotas de Alteração passam a tabela própria para não
 * poluir a tabela de Abertura com itens órfãos.
 */
export async function createOrGetSession(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  tableName?: string,
): Promise<SessionResult> {
  const existing = cookieStore.get(SESSION_COOKIE)?.value;
  if (existing) {
    try {
      const { payload } = await jwtVerify(existing, JWT_SECRET);
      if (typeof payload.sub === 'string') {
        return { sessionId: payload.sub, token: existing, isNew: false };
      }
    } catch {
      // inválido/expirado — cai para criar uma nova sessão
    }
  }

  const sessionId = randomUUID();
  const token = await new SignJWT({ sub: sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_EXPIRY}s`)
    .sign(JWT_SECRET);

  await ensureRascunhoInicial(sessionId, tableName);

  return { sessionId, token, isNew: true };
}

export function sessionCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   SESSION_EXPIRY,
    path:     '/',
  };
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;

/** Retorna false se a sessão não existe na tabela informada (default: Abertura) ou já foi submetida (status 'enviado'). */
export async function requireSession(sessionId: string, tableName?: string): Promise<boolean> {
  const item = await getRascunho(sessionId, tableName);
  return !!item && item.status !== 'enviado';
}
