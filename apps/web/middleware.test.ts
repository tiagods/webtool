// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { TERMO_VERSAO_ATUAL } from '@prolink/shared';

const SECRET = 'dev-secret-change-in-production';

let middleware: typeof import('./middleware').middleware;

beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', SECRET);
  ({ middleware } = await import('./middleware'));
});

async function assinar(payload: Record<string, unknown>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(SECRET));
}

function requestComCookie(token?: string) {
  return new NextRequest('http://localhost/abertura', {
    headers: token ? { cookie: `prolink_aceite=${token}` } : {},
  });
}

function aceitePendente(res: Response) {
  return res.headers.get('x-middleware-request-x-aceite-pendente');
}

describe('middleware de aceite LGPD', () => {
  it('marca aceite pendente quando não há cookie', async () => {
    const res = await middleware(requestComCookie());

    expect(res.headers.get('x-middleware-next')).toBe('1');
    expect(aceitePendente(res)).toBe('1');
    expect(res.headers.get('x-middleware-override-headers')).toContain('x-aceite-pendente');
  });

  it('marca aceite pendente quando o token é inválido', async () => {
    const res = await middleware(requestComCookie('token-invalido'));

    expect(res.headers.get('x-middleware-next')).toBe('1');
    expect(aceitePendente(res)).toBe('1');
  });

  it('deixa passar quando o aceite está válido e na versão atual do termo', async () => {
    const token = await assinar({ versaoTermo: TERMO_VERSAO_ATUAL });
    const res = await middleware(requestComCookie(token));

    expect(res.headers.get('x-middleware-next')).toBe('1');
    expect(aceitePendente(res)).toBeNull();
  });

  it('marca aceite pendente quando a versão do termo está desatualizada', async () => {
    const token = await assinar({ versaoTermo: 'versao-antiga' });
    const res = await middleware(requestComCookie(token));

    expect(res.headers.get('x-middleware-next')).toBe('1');
    expect(aceitePendente(res)).toBe('1');
  });

  it('falha ao carregar quando JWT_SECRET não está definido', async () => {
    const original = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    vi.resetModules();

    await expect(import('./middleware')).rejects.toThrow(/JWT_SECRET/);

    process.env.JWT_SECRET = original;
  });
});