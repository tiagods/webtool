import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { alteracaoFormDraftSchema, type AlteracaoFormValues } from '@prolink/shared';
import { getRascunho, putRascunho, getAlteracaoTableName } from '@/lib/aws/dynamodb';
import { requireAceite, requireSession, SESSION_COOKIE_NAME } from '@/lib/auth';

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

type GuardResult = { ok: true; sessionId: string } | { ok: false; response: NextResponse };

async function guard(cookieStore: Awaited<ReturnType<typeof cookies>>): Promise<GuardResult> {
  if (!(await requireAceite(cookieStore))) {
    return { ok: false, response: NextResponse.json({ error: 'Termo de ciência não aceito' }, { status: 403 }) };
  }

  const sessionId = await getSessionId(cookieStore);
  if (!sessionId || !(await requireSession(sessionId, getAlteracaoTableName()))) {
    return { ok: false, response: NextResponse.json({ error: 'Sessão inválida ou expirada' }, { status: 403 }) };
  }

  return { ok: true, sessionId };
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const guarded = await guard(cookieStore);
    if (!guarded.ok) return guarded.response;

    const item = await getRascunho<AlteracaoFormValues>(guarded.sessionId, getAlteracaoTableName());
    return NextResponse.json({ payload: item?.payload ?? null });
  } catch (err) {
    console.error('[alteracao/draft][GET] error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const guarded = await guard(cookieStore);
    if (!guarded.ok) return guarded.response;
    const { sessionId } = guarded;

    const body = await req.json();

    const parsed = alteracaoFormDraftSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Payload inválido', issues: parsed.error.issues }, { status: 400 });
    }

    await putRascunho(sessionId, parsed.data, getAlteracaoTableName());
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[alteracao/draft][POST] error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
