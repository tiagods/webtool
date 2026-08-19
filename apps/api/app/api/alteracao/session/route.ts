import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireAceite, createOrGetSession, sessionCookieOptions, SESSION_COOKIE_NAME } from '@/lib/auth';
import { ensureRascunhoInicial, getAlteracaoTableName } from '@/lib/aws/dynamodb';

export async function POST() {
  try {
    const cookieStore = await cookies();

    if (!(await requireAceite(cookieStore))) {
      return NextResponse.json({ error: 'Termo de ciência não aceito' }, { status: 403 });
    }

    const { token, sessionId, isNew } = await createOrGetSession(cookieStore);

    // Idempotente (if_not_exists) — necessário mesmo quando a sessão já existia
    // (ex.: usuário veio da Abertura), pois o item da tabela de Alteração é próprio.
    await ensureRascunhoInicial(sessionId, getAlteracaoTableName());

    const res = NextResponse.json({ ok: true });

    if (isNew) {
      res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    }

    return res;
  } catch (err) {
    console.error('[alteracao/session] error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
