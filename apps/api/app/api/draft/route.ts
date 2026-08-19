import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { aberturaFormDraftSchema } from '@prolink/shared';
import { getRascunho, putRascunho, putDocumentoKey } from '@/lib/aws/dynamodb';
import { getExtension, isAllowedContentType } from '@/lib/aws/s3';
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
  if (!sessionId || !(await requireSession(sessionId))) {
    return { ok: false, response: NextResponse.json({ error: 'Sessão inválida ou expirada' }, { status: 403 }) };
  }

  return { ok: true, sessionId };
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const guarded = await guard(cookieStore);
    if (!guarded.ok) return guarded.response;

    const item = await getRascunho(guarded.sessionId);
    return NextResponse.json({
      payload: item?.payload ?? null,
      documentosKeys: item?.documentosKeys ?? null,
    });
  } catch (err) {
    console.error('[draft][GET] error:', err);
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

    // Variante 1: confirmação de upload — persiste a key do documento (merge em documentosKeys)
    if (typeof body?.uploadedCampo === 'string') {
      const { uploadedCampo: campo, contentType } = body as { uploadedCampo: string; contentType?: unknown };

      if (!/^[a-z0-9_]{1,80}$/.test(campo)) {
        return NextResponse.json({ error: 'campo inválido' }, { status: 400 });
      }
      if (typeof contentType !== 'string' || !isAllowedContentType(contentType)) {
        return NextResponse.json(
          { error: 'contentType deve ser application/pdf, image/jpeg ou image/png' },
          { status: 400 },
        );
      }

      const ext = getExtension(contentType);
      const key = `${sessionId}/documentos/${campo}.${ext}`;
      await putDocumentoKey(sessionId, campo, key);

      return NextResponse.json({ ok: true });
    }

    // Variante 2: salvar rascunho do formulário
    const parsed = aberturaFormDraftSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Payload inválido', issues: parsed.error.issues }, { status: 400 });
    }

    await putRascunho(sessionId, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[draft][POST] error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
