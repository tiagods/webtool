import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { aberturaFormSchema } from '@prolink/shared';
import { getRascunho, marcarEnviado, proximoProtocolo } from '@/lib/aws/dynamodb';
import { copyObject, deleteObjectsWithPrefix } from '@/lib/aws/s3';
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
    if (!sessionId || !(await requireSession(sessionId))) {
      return NextResponse.json({ error: 'Sessão inválida ou expirada' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = aberturaFormSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Payload inválido', issues: parsed.error.issues }, { status: 400 });
    }

    const tipo = parsed.data.dadosEmpresa.tipoConstituicao;
    const item = await getRascunho(sessionId);
    const documentosKeys = item?.documentosKeys ?? {};

    const protocolo = await proximoProtocolo();
    const sessionPrefix = `${sessionId}/documentos/`;
    const destPrefix = `protocolos/${protocolo}/`;

    await Promise.all(
      Object.values(documentosKeys).map((sourceKey) =>
        copyObject(sourceKey, sourceKey.replace(sessionPrefix, destPrefix)),
      ),
    );

    await publishSubmissao({ sessionId, protocolo, formType: 'abertura', tipo });

    // Status muda para 'enviado' no DynamoDB antes de invalidar o cookie — fecha a janela
    // de reuso de um JWT ainda válido (ver "Invalidação server-side" na spec). `tipo` é
    // regravado aqui com o valor validado do submit (pode ter mudado desde o último draft).
    await marcarEnviado(sessionId, protocolo, tipo);

    await deleteObjectsWithPrefix(`${sessionId}/`);

    const res = NextResponse.json({ protocolo });
    res.cookies.set(SESSION_COOKIE_NAME, '', { maxAge: 0, path: '/' });

    return res;
  } catch (err) {
    console.error('[submit] error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
