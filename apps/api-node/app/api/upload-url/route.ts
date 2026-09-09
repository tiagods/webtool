import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getPresignedUploadUrl, getExtension, isAllowedContentType } from '@/lib/aws/s3';
import { requireAceite, createOrGetSession, sessionCookieOptions, SESSION_COOKIE_NAME } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Muitas requisições. Tente novamente em instantes.' },
        { status: 429 },
      );
    }

    const cookieStore = await cookies();
    if (!(await requireAceite(cookieStore))) {
      return NextResponse.json({ error: 'Termo de ciência não aceito' }, { status: 403 });
    }

    const body = await req.json() as { campo?: unknown; contentType?: unknown };
    const { campo, contentType } = body;

    if (typeof campo !== 'string' || !/^[a-z0-9_]{1,80}$/.test(campo)) {
      return NextResponse.json({ error: 'campo inválido' }, { status: 400 });
    }
    if (typeof contentType !== 'string' || !isAllowedContentType(contentType)) {
      return NextResponse.json(
        { error: 'contentType deve ser application/pdf, image/jpeg ou image/png' },
        { status: 400 }
      );
    }

    const { sessionId, token, isNew } = await createOrGetSession(cookieStore);

    const ext = getExtension(contentType);
    const key = `${sessionId}/documentos/${campo}.${ext}`;

    const url = await getPresignedUploadUrl(key, contentType);

    // Não retornamos a key ao cliente — ela contém o sessionId (namespace de segurança).
    // O cliente confirma o upload chamando POST /api/draft com { uploadedCampo, contentType }.
    const res = NextResponse.json({ url });

    if (isNew) {
      res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    }

    return res;
  } catch (err) {
    console.error('[upload-url] error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
