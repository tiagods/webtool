import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SignJWT } from 'jose';
import { randomUUID } from 'crypto';
import { aceiteTermoRequestSchema, type RegistroAceite, TERMO_VERSAO_ATUAL } from '@prolink/shared';
import { putRegistroAceite } from '@/lib/aws/dynamodb';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'dev-secret-change-in-production'
);
const ACEITE_COOKIE = 'prolink_aceite';
const ACEITE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 ano

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = aceiteTermoRequestSchema.safeParse(body);

    if (!parsed.success || parsed.data.versaoTermo !== TERMO_VERSAO_ATUAL) {
      return NextResponse.json({ error: 'versaoTermo inválida' }, { status: 400 });
    }

    const sessionId = randomUUID();
    const registro: RegistroAceite = {
      sessionId,
      versaoTermo: TERMO_VERSAO_ATUAL,
      aceitoEm: new Date().toISOString(),
      ip: req.headers.get('x-forwarded-for') ?? 'unknown',
      userAgent: req.headers.get('user-agent') ?? 'unknown',
    };

    await putRegistroAceite(registro);

    const token = await new SignJWT({ sub: sessionId, versaoTermo: TERMO_VERSAO_ATUAL })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(`${ACEITE_COOKIE_MAX_AGE}s`)
      .sign(JWT_SECRET);

    const cookieStore = await cookies();
    cookieStore.set(ACEITE_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure:   process.env.NODE_ENV === 'production',
      maxAge:   ACEITE_COOKIE_MAX_AGE,
      path:     '/',
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[aceite-termo] error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
