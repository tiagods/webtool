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

    const { token, sessionId, isNew } = await createOrGetSession(cookieStore, getAlteracaoTableName());

    // Idempotente (if_not_exists) — necessário quando a sessão já existia (ex.: usuário
    // veio da Abertura), caso em que createOrGetSession retorna sem criar o item próprio
    // da tabela de Alteração.
    if (!isNew) {
      await ensureRascunhoInicial(sessionId, getAlteracaoTableName());
    }

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
