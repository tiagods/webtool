// Verificação cruzada de JWT: valida com `jose` (a mesma lib do apps/web
// middleware.ts) um token assinado pela API Go (infrastructure/auth).
//
// Uso:
//   JWT_SECRET=... node scripts/verify-jwt-cross.mjs <token>
//   echo <token> | JWT_SECRET=... node scripts/verify-jwt-cross.mjs
//
// Sai com 0 e imprime as claims (JSON) em caso de sucesso; sai com 1 em caso de
// assinatura/expiração inválida.

import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
);

async function lerToken() {
  const arg = process.argv[2];
  if (arg) return arg.trim();

  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8').trim();
}

const token = await lerToken();
if (!token) {
  console.error('token ausente (argv[2] ou stdin)');
  process.exit(2);
}

try {
  const { payload, protectedHeader } = await jwtVerify(token, secret);
  console.log(JSON.stringify({ header: protectedHeader, payload }));
  process.exit(0);
} catch (err) {
  console.error(`jose rejeitou o token: ${err.code ?? err.message}`);
  process.exit(1);
}
