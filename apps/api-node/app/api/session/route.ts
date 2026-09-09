import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { requireAceite, createOrGetSession, sessionCookieOptions, SESSION_COOKIE_NAME } from '@/lib/auth';
import { getRascunho, deleteDraft } from '@/lib/aws/dynamodb';
import { deleteObjectsWithPrefix } from '@/lib/aws/s3';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'dev-secret-change-in-production'
);

async function getSessionId(cookieStore: Awaited<ReturnType<typeof cookies>>): Promise<string | null> {
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function POST() {
  try {
    const cookieStore = await cookies();

    if (!(await requireAceite(cookieStore))) {
      return NextResponse.json({ error: 'Termo de ciência não aceito' }, { status: 403 });
    }

    const { token, isNew } = await createOrGetSession(cookieStore);

    const res = NextResponse.json({ ok: true });

    if (isNew) {
      res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    }

    return res;
  } catch (err) {
    console.error('[session] error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

/**
 * Exclusão de dados sob solicitação (LGPD Art. 18). Usa `getRascunho` diretamente (não
 * `requireSession`) porque precisa diferenciar "sessão inexistente" (403) de "sessão já
 * enviada" (409) — `requireSession` colapsa os dois casos no mesmo `false`.
 */
export async function DELETE() {
  try {
    const cookieStore = await cookies();

    const sessionId = await getSessionId(cookieStore);
    if (!sessionId) {
      return NextResponse.json({ error: 'Sessão inválida ou expirada' }, { status: 403 });
    }

    const item = await getRascunho(sessionId);
    if (!item) {
      return NextResponse.json({ error: 'Sessão inválida ou expirada' }, { status: 403 });
    }

    if (item.status === 'enviado') {
      return NextResponse.json(
        { error: 'Sessão já enviada — exclusão de dados protocolados exige contato direto com a empresa' },
        { status: 409 },
      );
    }

    await deleteObjectsWithPrefix(`${sessionId}/`);
    await deleteDraft(sessionId);

    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE_NAME, '', { maxAge: 0, path: '/' });

    return res;
  } catch (err) {
    console.error('[session][DELETE] error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
