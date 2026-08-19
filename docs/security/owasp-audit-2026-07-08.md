# Auditoria OWASP Top 10 — prolink/webtool — 2026-07-08

## Sumário executivo

- **Escopo:** monorepo TypeScript / Next.js 14.2.35 — `apps/api` (Route Handlers + `lib/auth`, `lib/rateLimit`, `lib/aws/*`), `apps/web` (`middleware.ts`, `next.config.mjs`), `infra/nginx`, `Caddyfile`, `docker-compose*.yml`. Dados LGPD (CPF, RG, endereço de sócios) persistidos em DynamoDB/S3 e publicados em SQS.
- **Achados:** 0 críticos · 0 altos · 6 médios · 2 baixos · 3 informativos
- **Contexto arquitetural (Spec 009):** a separação frontend/backend é um controle de segurança deliberado e eficaz — ver a seção **"Arquitetura de segurança"** abaixo. Ela protege a **camada de rede e as credenciais**, mas **não neutraliza os achados de aplicação**, que continuam alcançáveis pelo caminho público legítimo `Caddy → Nginx → api`. "API não exposta" significa "sem acesso de rede direto à porta 3001", não "API inatacável".
- **Riscos principais:**
  - **`JWT_SECRET` sem validação fail-closed:** o `docker-compose.prod.yml` exige a env (não embute o default público), mas se ela for esquecida o Compose injeta `""` e o código assina com chave vazia — silenciosamente. Chave forjável = bypass total de autenticação.
  - **Superfície de abuso sem rate limit:** só `/api/upload-url` é limitado; `/api/aceite-termo` (público, sem auth) grava no DynamoDB a cada request.
  - **O único rate limit é contornável** via `X-Forwarded-For` spoofável (agravado por dois proxies na frente: Caddy e Nginx).

## Arquitetura de segurança (Spec 009) — controles positivos

A separação frontend/backend é sólida e reduz a superfície de ataque de forma real. Creditando explicitamente:

- **Isolamento de credenciais (A05/defesa em profundidade):** o processo público (`web`) não tem acesso à AWS; só o `api` carrega as credenciais/IAM role. Um comprometimento do frontend não expõe DynamoDB/S3/SQS diretamente.
- **API fora de acesso de rede direto:** em produção, o firewall bloqueia a 3001 e o Caddy é o único ponto de entrada (TLS). O processo com acesso a dados sensíveis não recebe conexões diretas da internet — reduz varredura/exploração de rede e exposição de rotas internas.
- **Produção não embute o segredo default:** `docker-compose.prod.yml` usa `JWT_SECRET: ${JWT_SECRET}` (sem `:-default`), então o literal `dev-secret-change-in-production` **não** vai para produção (ao contrário do dev). Ver o achado abaixo para o resíduo (string vazia).
- **TLS automático (A02):** o Caddy termina TLS com Let's Encrypt e renova sozinho.
- **CORS do S3 restrito (A05):** `infra/aws/set-cors-producao.sh` limita o CORS do bucket ao domínio de produção — não é `*`.
- **Controle de acesso amarrado ao JWT (A01):** o `sessionId` sempre deriva do `sub` verificado, nunca de input — namespacing correto de S3/DynamoDB (ver "Categorias sem achados").

**Limite desta defesa:** todos os achados abaixo (exceto onde indicado) chegam ao `api` pelo fluxo HTTP legítimo que o Caddy/Nginx repassam. A separação não é uma camada de autorização nem de validação de aplicação — por isso os itens de A03/A04/A07 permanecem.

## Achados

### [MÉDIO] `JWT_SECRET` sem validação fail-closed (risco de chave vazia/fraca em produção) — A02:2021 / A07:2021

- **Local:** `apps/api/lib/auth.ts:7-9` e repetido em `apps/api/app/api/{aceite-termo,draft,session,submit}/route.ts`, `apps/web/middleware.ts:5-7`; composição em `docker-compose.prod.yml:13,34`.
- **Descrição:** o código usa `process.env.JWT_SECRET ?? 'dev-secret-change-in-production'`. Como `??` só cai no default para `null`/`undefined`, uma env definida como **string vazia** passa direto. O `docker-compose.prod.yml` faz `JWT_SECRET: ${JWT_SECRET}` — se o operador não fornecer o valor no host/`.env`, o Compose interpola `""` (apenas com um warning) e a aplicação assina/verifica JWT com **chave vazia**. Não há nenhuma checagem que rejeite segredo ausente/vazio em produção.
- **Cenário de exploração:** deploy sem `JWT_SECRET` definido → chave vazia (conhecida). Atacante assina um JWT `{ sub: '<sessionId-alvo>' }` (sessão) e um cookie de aceite com HS256 e chave vazia, e passa a ler/gravar o rascunho de qualquer sessão (`GET /api/draft`) e contornar o gate de aceite. Bypass total de autenticação. (A separação de rede não protege contra isso — o ataque usa o fluxo HTTP normal.)
- **Remediação:** falhar fechado, num único módulo, tratando também string vazia:
  ```ts
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET ausente/vazio em produção');
    // dev: default explícito
  }
  ```
  Centralizar em `lib/auth.ts` e importar (hoje o literal está duplicado em 6 arquivos). Opcional: exigir comprimento mínimo. **Verificar imediatamente se o deploy atual define `JWT_SECRET`** — se não definir, promover este achado a Alto.

### [MÉDIO] Rate limiting ausente na maioria dos endpoints (inclui entrada pública não-autenticada) — A04:2021 – Insecure Design

- **Local:** `apps/api/app/api/aceite-termo/route.ts:14` (sem limite), `session/route.ts:24`, `draft/route.ts:40,57`, `submit/route.ts:26`; único uso do limitador em `upload-url/route.ts:14`.
- **Descrição:** `checkRateLimit` só protege `/api/upload-url`. `/api/aceite-termo` é público (sem auth) e a cada request gera `sessionId`, assina JWT e faz `putRegistroAceite` (write no DynamoDB, TTL 5 anos). Alcançável pela internet via Caddy/Nginx — a separação não limita a taxa.
- **Cenário de exploração:** milhares de `POST /api/aceite-termo` → writes ilimitados no DynamoDB (custo + poluição da tabela LGPD) e geração ilimitada de cookies; spam em `/api/submit` gera saltos no contador de protocolo e mensagens SQS/cópias S3 em excesso.
- **Remediação:** aplicar rate limit em todos os handlers públicos/sensíveis, especialmente `/api/aceite-termo`; considerar CAPTCHA no gate de aceite. Migrar o limitador para store compartilhado (ver próximo achado e a limitação multi-instância documentada em `lib/rateLimit.ts`).

### [MÉDIO] Rate limit contornável — IP extraído do `X-Forwarded-For` spoofável — A04:2021 / A07:2021

- **Local:** `apps/api/app/api/upload-url/route.ts:7-9`; `infra/nginx/default.conf:7`; cadeia de proxies `Caddy → Nginx`.
- **Descrição:** `getClientIp` faz `req.headers.get('x-forwarded-for')?.split(',')[0]`. O Nginx usa `$proxy_add_x_forwarded_for`, que **acrescenta** o IP de origem ao valor recebido; o Caddy, à frente, também repassa/adiciona. O valor enviado pelo cliente permanece no início da lista, então `[0]` retorna justamente o valor **controlado pelo atacante**. A presença de dois proxies aumenta o número de hops, mas nenhum deles descarta o header do cliente.
- **Cenário de exploração:** atacante envia cada request com um `X-Forwarded-For` aleatório distinto → cada request cai num bucket novo do limitador → o limite de 20/min nunca é atingido (bypass trivial).
- **Remediação:** confiar apenas no IP que o proxy da borda anexa. Definir `proxy_set_header X-Real-IP $remote_addr;` no Nginx (e/ou usar o header confiável do Caddy) e ler esse header no app; ou extrair o **último** elemento do `X-Forwarded-For`. Nunca usar o primeiro elemento como identidade.

### [MÉDIO] Upload via presigned URL sem limite de tamanho — A04:2021 – Insecure Design

- **Local:** `apps/api/lib/aws/s3.ts:48-64` (`getPresignedUploadUrl`).
- **Descrição:** o `PutObjectCommand` assinado não impõe `content-length-range`. O upload vai **direto do browser para o S3**, sem passar por Caddy/Nginx/api — logo nenhum limite de proxy ou controle da aplicação se aplica. Este é o achado **menos** afetado pela arquitetura: ele contorna toda a topologia da Spec 009.
- **Cenário de exploração:** com uma sessão válida (aceite é trivial), o cliente usa a URL assinada para enviar um arquivo de tamanho arbitrário (GBs) ao bucket → esgotamento de armazenamento e custo, multiplicado pela ausência de rate limit sob spoof de IP.
- **Remediação:** usar presigned **POST** com `Conditions: [['content-length-range', 0, MAX_BYTES]]` (ex.: 10 MB por tipo) e revalidar o tamanho na confirmação (`POST /api/draft`).

### [MÉDIO] Cabeçalhos de segurança ausentes — A05:2021 – Security Misconfiguration

- **Local:** `apps/web/next.config.mjs` (sem `headers()`), `infra/nginx/default.conf` e `Caddyfile` (sem `add_header`/`header`), `apps/web/middleware.ts` (não seta headers de resposta).
- **Descrição:** nenhuma camada emite `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors`, `Strict-Transport-Security` ou `X-Content-Type-Options`. O TLS já é garantido pelo Caddy (mitiga downgrade na conexão), mas sem **HSTS** o navegador não memoriza a preferência por HTTPS, e sem `X-Frame-Options`/CSP a página de coleta de CPF/RG fica sujeita a clickjacking.
- **Cenário de exploração:** embutir o formulário `/abertura` num iframe malicioso (clickjacking) para induzir preenchimento/envio; ausência de CSP facilita exploração de eventual injeção.
- **Remediação:** adicionar os headers no ponto de borda. O mais natural aqui é o **Caddy** (`header` no `Caddyfile`) ou o `headers()` do `next.config.mjs` do `web`: no mínimo `X-Frame-Options: DENY` (ou CSP `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Strict-Transport-Security` e uma CSP restritiva.

### [MÉDIO] Next.js com vulnerabilidades conhecidas — A06:2021 – Vulnerable and Outdated Components

- **Local:** `apps/web/package.json`, `apps/api/package.json` (`next@14.2.35`); `npm audit`: 1 high + 1 moderate.
- **Descrição:** a versão em uso permanece na faixa vulnerável de vários avisos do Next (DoS via Image Optimizer/Server Components, cache poisoning em middleware/redirects, SSRF em WebSocket upgrades) e do `postcss` transitivo (XSS no stringify). A separação **reduz** a exposição do lado `api` (só alcançável via borda), mas o `web` é totalmente público e usa `middleware.ts` — dentro do escopo do aviso de cache poisoning.
- **Cenário de exploração:** conforme o aviso, DoS remoto ou envenenamento de cache de proxy/middleware. Sem exploração trivial confirmada no fluxo atual, mas a superfície é real no `web`.
- **Remediação:** atualizar o Next para a versão corrigida (correção completa exige salto de major — `npm audit fix --force` sugere `next@16`, breaking; avaliar upgrade planejado). No mínimo, subir para o patch mais recente da linha 14 e reavaliar `npm audit`.

### [BAIXO] Submissão não-atômica / TOCTOU entre `requireSession` e `marcarEnviado` — A04:2021

- **Local:** `apps/api/app/api/submit/route.ts:34-66`.
- **Descrição:** o guard lê `status` (`requireSession`) e só mais adiante grava `status='enviado'` (`marcarEnviado`), sem condição atômica entre as etapas.
- **Cenário de exploração:** dois `POST /api/submit` concorrentes com o mesmo cookie podem ambos passar o `requireSession` (status ainda `rascunho`) antes de qualquer `marcarEnviado`, gerando dois protocolos, cópias S3 duplicadas e duas mensagens SQS.
- **Remediação:** tornar a transição atômica — `marcarEnviado` com `ConditionExpression: '#s = :rascunho'` e executá-la **antes** dos efeitos colaterais (SQS/cópia), reforçando a idempotência.

### [BAIXO] Detalhes de validação (`issues` do Zod) retornados ao cliente — A05:2021

- **Local:** `apps/api/app/api/draft/route.ts:90`, `apps/api/app/api/submit/route.ts:42`.
- **Descrição:** respostas 400 incluem `parsed.error.issues` completo, expondo a estrutura interna do schema (caminhos, códigos, constraints). Baixo impacto — os `issues` do Zod não incluem os valores enviados por padrão.
- **Remediação:** retornar mensagem genérica ou resumo mínimo (campo + mensagem) em produção, mantendo o detalhe apenas em logs internos.

## Categorias verificadas sem achados

- **A01 – Broken Access Control:** bem tratado. O `sessionId` sempre deriva do `sub` do JWT verificado (`getSessionId`), nunca de input; chaves de S3/DynamoDB namespaced por `sessionId`; o segmento controlável (`campo`) é validado por regex `^[a-z0-9_]{1,80}$`, bloqueando path traversal e IDOR. **Depende do achado do `JWT_SECRET` (segredo forte).**
- **A03 – Injection:** sem SQL/ORM (DynamoDB com `ExpressionAttributeValues` parametrizados e `ExpressionAttributeNames` para o nome de campo dinâmico em `putDocumentoKey`), sem `eval`/`child_process` no caminho de request, sem `dangerouslySetInnerHTML`.
- **A10 – SSRF:** o único `fetch` server-side relevante é o ViaCEP (`apps/web/lib/viacep.ts`) com host fixo e input restrito a dígitos; sem URL derivada de input livre.

## Falsos positivos verificados

Candidatos levantados pelo recon/varredura que foram investigados na Fase 4 e **descartados** — registrados aqui para a trilha de auditoria (foram considerados, não ignorados).

- **`execSync(...)` em `apps/web/scripts/free-port.js:10,29,50,52` — (Falso positivo)** — sinalizado como command injection (A03). É um utilitário **de desenvolvimento** (libera a porta local antes do `dev`), fora do bundle de produção e do caminho de request. Os argumentos (`port`, `pid`) vêm de configuração/saída de `netstat` local, não de input do atacante. Sem superfície remota.
- **Defaults `?? 'test'` / `?? 'us-east-1'` / `?? 'fichas-abertura'` em `apps/api/lib/aws/*` — (Falso positivo)** — casaram no padrão de "segredo com default hardcoded" (A02). Não são segredos: são nome de região/tabela/bucket. As credenciais fake `'test'/'test'` só entram no objeto do client **quando `AWS_ENDPOINT_URL` está definido** (spread condicional para o Floci local); em produção `AWS_ENDPOINT_URL` é ausente, o bloco de credenciais não é aplicado e o SDK usa a IAM role/cadeia padrão. O `'test'` nunca chega à AWS real.
- **`console.error('[rota] error:', err)` nas rotas de API — (Falso positivo)** — sinalizado como logging sensível (A09). Verificado: registram apenas um prefixo estático + o objeto de erro; não logam `payload`, corpo do request nem PII (CPF/RG). O logging de PII não ocorre.
- **`err.message` em `apps/web/components/UploadField.tsx:88` — (Falso positivo)** — casou no padrão de "erro verboso ao cliente" (A05). É código **client-side** montando a mensagem de UI a partir do erro do próprio `fetch` no navegador — não é o servidor vazando stack/detalhe interno. Os handlers server-side retornam `{ error: 'Erro interno' }` genérico.
- **`fetch(...)` em `apps/web/lib/viacep.ts:38` — (Falso positivo)** — sinalizado como SSRF (A10). O host é fixo (`viacep.com.br`) e o input é restrito a dígitos (CEP normalizado); o atacante não influencia host/porta/esquema. Sem SSRF.

## Notas e limitações

- **A08 (integridade):** o worker consumidor do SQS ainda não existe (Fase 7 planejada). Quando implementado, deve **revalidar** a mensagem com o schema compartilhado antes de agir — a mensagem atual carrega só `sessionId/protocolo/tipo` (sem PII), limitando o risco imediato.
- **Criptografia em repouso (A02):** não verificável estaticamente — a cifragem de DynamoDB/S3 depende da configuração AWS (IaC/console) fora deste código. Confirmar SSE no bucket e encryption-at-rest na tabela.
- **Integridade do registro LGPD:** o `ip` gravado em `putRegistroAceite` vem do `X-Forwarded-For` bruto e spoofável (mesma raiz do achado de rate limit). Como é prova legal de aceite, registrar o IP confiável anexado pelo proxy da borda.
- **Tratamento de erro server-side (positivo):** todos os handlers retornam `{ error: 'Erro interno' }` genérico em 500, sem vazar stack/mensagem.
- **Dependência operacional (Spec 009):** a proteção de rede da API depende do firewall do servidor bloquear a 3001 (documentado em `deploy.md`). Se o firewall não for configurado, o `api` fica exposto diretamente à internet — validar no ambiente real.
- Auditoria estática. Recomenda-se complementar com teste dinâmico (DAST) e revisão da configuração AWS/IAM (políticas dos recursos, firewall, CORS do bucket real).
