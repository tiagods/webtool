import { http, HttpResponse, type JsonBodyType } from 'msw';

const json = (body: JsonBodyType, status = 200) => HttpResponse.json(body, { status });

export const handlers = [
  http.post('/api/session', () => json({ sessionId: 'sess-test' })),
  http.get('/api/draft', () => json({ payload: null })),
  http.post('/api/draft', () => json({ ok: true })),
  http.post('/api/submit', () => json({ protocolo: 'PROT-2026-0001' })),

  http.post('/api/alteracao/session', () => json({ sessionId: 'sess-test' })),
  http.get('/api/alteracao/draft', () => json({ payload: null })),
  http.post('/api/alteracao/draft', () => json({ ok: true })),
  http.post('/api/alteracao/submit', () => json({ protocolo: 'ALT-2026-0001' })),

  http.post('/api/upload-url', () => json({ url: 'https://s3.test/presigned' })),
  http.put('https://s3.test/presigned', () => new HttpResponse(null, { status: 200 })),

  http.post('/api/aceite-termo', () => json({ ok: true })),

  http.get('https://viacep.com.br/ws/:cep/json/', () =>
    json({
      cep: '01310-100',
      logradouro: 'Avenida Paulista',
      bairro: 'Bela Vista',
      localidade: 'São Paulo',
      uf: 'SP',
    })
  ),
];