import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { alteracaoFormSchema } from '@prolink/shared';
import { marcarEnviado, proximoProtocolo, getAlteracaoTableName } from '@/lib/aws/dynamodb';
import { putJsonObject } from '@/lib/aws/s3';
import { publishSubmissao } from '@/lib/aws/sqs';
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

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();

    if (!(await requireAceite(cookieStore))) {
      return NextResponse.json({ error: 'Termo de ciência não aceito' }, { status: 403 });
    }

    const sessionId = await getSessionId(cookieStore);
    if (!sessionId || !(await requireSession(sessionId, getAlteracaoTableName()))) {
      return NextResponse.json({ error: 'Sessão inválida ou expirada' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = alteracaoFormSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Payload inválido', issues: parsed.error.issues }, { status: 400 });
    }

    const tipo = parsed.data.identificacao.tipoConstituicao;
    const protocolo = await proximoProtocolo('ALT-', getAlteracaoTableName());

    // Sem upload de arquivos neste formulário (Spec 012) — o backup é o próprio payload validado.
    await putJsonObject(`protocolos/${protocolo}/alteracao.json`, parsed.data);

    await publishSubmissao({ sessionId, protocolo, formType: 'alteracao', tipo });

    await marcarEnviado(sessionId, protocolo, tipo, getAlteracaoTableName());

    const res = NextResponse.json({ protocolo });
    res.cookies.set(SESSION_COOKIE_NAME, '', { maxAge: 0, path: '/' });

    return res;
  } catch (err) {
    console.error('[alteracao/submit] error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
