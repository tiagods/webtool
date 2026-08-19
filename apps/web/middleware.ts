import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { TERMO_VERSAO_ATUAL } from '@prolink/shared';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'dev-secret-change-in-production'
);
const ACEITE_COOKIE = 'prolink_aceite';

async function temAceiteValido(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload.versaoTermo === TERMO_VERSAO_ATUAL;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const aceitou = await temAceiteValido(req.cookies.get(ACEITE_COOKIE)?.value);

  if (aceitou) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-aceite-pendente', '1');

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
