# Lições Aprendidas

> Documento acumulativo. Nunca é resetado. Consultado no início de cada sessão.

---

<!-- Adicionar lições no formato abaixo -->
<!--
## [Data] — [Contexto]

**Erro**: o que aconteceu
**Causa raiz**: por que aconteceu
**Regra**: o que fazer diferente no futuro
-->

## 2026-07-02 — Spec 008 (Backend APIs)

**Erro**: `npm run build` (produção) executado enquanto `npm run dev` estava rodando na mesma app quebrou o dev server (`.next` é compartilhado entre os dois; erro "Cannot find module './chunks/vendor-chunks/next.js'").
**Causa raiz**: dev e build gravam no mesmo diretório `.next`; rodar um build de produção por cima de um dev server ativo corrompe o cache/webpack-runtime dele.
**Regra**: nunca rodar `npm run build` para verificação enquanto o dev server da mesma app estiver de pé. Parar o dev server antes, ou rodar build antes de subir o dev server. Se corromper, `rm -rf apps/web/.next` e reiniciar o dev server resolve.

## 2026-07-02 — Spec 008 (Backend APIs)

**Erro**: `aberturaFormSchema.partial()` (citado literalmente na spec 008) não existe — Zod não expõe `.partial()` em `ZodEffects` (retorno de `.superRefine()`).
**Causa raiz**: qualquer schema Zod que passa por `.refine()`/`.superRefine()` deixa de ser um `ZodObject` puro e perde `.partial()`, `.extend()`, `.pick()`, etc.
**Regra**: ao desenhar um schema Zod que precisará de validação parcial (rascunhos, PATCH), exportar o `z.object({...})` base **antes** de aplicar `.superRefine()`/`.refine()`, e aplicar o refine numa constante separada. Ver `aberturaFormObjectSchema` vs `aberturaFormSchema` em `packages/shared/src/schemas/abertura.ts`.

## 2026-07-07 — Spec 009 (Separação Frontend/Backend)

**Erro**: `apps/api/tsconfig.json` com `"lib": ["esnext"]` (sem `dom`) quebrou o build com `Property 'uploadedCampo' does not exist on type '{}'` em `req.json()` dentro de uma Route Handler.
**Causa raiz**: mesmo num workspace só-de-API sem nenhuma página/UI, os tipos de `NextRequest`/`Body.json()` do Next.js dependem de `lib.dom.d.ts` (`Request`/`Response` globais). Sem `dom` no `lib`, o TypeScript infere um tipo `{}` mais fraco para o corpo da requisição.
**Regra**: workspaces Next.js que só expõem Route Handlers ainda devem herdar `lib: ["dom", "dom.iterable", "esnext"]` do `tsconfig.base.json` (não remover `dom`) — a ausência de UI não implica ausência de tipos DOM, pois as Route Handlers são construídas sobre a Fetch API padrão.

## 2026-07-07 — Spec 009 (Separação Frontend/Backend)

**Erro**: `next.config.mjs` com `outputFileTracingRoot` no nível raiz do config gerou `⚠ Invalid next.config.mjs options detected: Unrecognized key(s) in object: 'outputFileTracingRoot'` ao rodar `next dev`.
**Causa raiz**: no Next.js 14.2.35, `outputFileTracingRoot` ainda é uma opção `experimental` (só foi promovida para o nível raiz em versões posteriores do Next 15+) — precisa ficar dentro de `experimental: { outputFileTracingRoot: ... }`.
**Regra**: ao configurar `output: 'standalone'` num monorepo com Next 14.x, colocar `outputFileTracingRoot` dentro de `experimental`, não no nível raiz do `nextConfig`. Verificar a versão do Next antes de assumir que uma opção documentada nos docs mais recentes já está estável na versão instalada.

## 2026-07-07 — Spec 010 (Hardening de Deploy) — validação manual E2E

**Erro**: `POST /api/draft` retornava 400 (`"Você precisa aceitar os termos de consentimento"`) em **todo** salvamento de rascunho antes do último passo, porque `documentosAceitos: z.boolean().refine(val => val === true)` (campo do passo final) estava presente no payload com valor `false` (default) durante todos os passos anteriores. `aberturaFormDraftSchema = aberturaFormObjectSchema.strict().partial()` só torna a CHAVE opcional (pode estar ausente) — não remove o `.refine()` quando o valor está presente. Como `saveDraft()` (`StepperEngine.tsx`) engolia o erro só com `console.error` e `handleNext` navegava para o próximo passo mesmo se o salvamento falhasse, o bug ficava invisível: a navegação "parecia" funcionar, mas nada era persistido.
**Causa raiz**: `.partial()` do Zod é raso e não remove `.refine()`/constraints de campos presentes — só afeta a obrigatoriedade da chave existir. Combinado com uma função de salvamento que não propaga falhas para quem decide navegar, um erro 400 silencioso vira "perda de dados" do ponto de vista do usuário.
**Regra**: (1) ao criar uma variante "draft/partial" de um schema Zod com campos que só fazem sentido como obrigatórios/`true` no passo final, sobrescrever esse campo explicitamente via `.extend({ campo: z.tipo().optional() })` após o `.partial()` — não confiar que `.partial()` sozinho relaxa refines. (2) Toda função de "salvar progresso" que roda antes de uma navegação deve retornar sucesso/falha, e o chamador deve **bloquear a navegação e avisar o usuário** se falhar — nunca engolir o erro só em `console.error` e seguir em frente como se tivesse funcionado.

## 2026-07-02 — Ambiente Windows (Docker Desktop)

**Erro**: todo comando `docker` (Bash e PowerShell) ficou pendurado indefinidamente ("running in background", nunca retornava), inclusive comandos triviais como `docker inspect`.
**Causa raiz**: o motor do Docker Desktop estava fora do ar (`failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`) — não era um problema do comando em si nem do shell.
**Regra**: se **todo** comando `docker` travar (mesmo os mais simples, em shells diferentes), suspeitar do motor do Docker Desktop antes de tentar variações de sintaxe — rodar um comando não-Docker trivial (`echo`) para confirmar que o shell em si está saudável, depois pedir para o usuário verificar/reiniciar o Docker Desktop.

## 2026-07-13 — Spec 012 (Ficha de Alteração) — `FormLabel` fora de `FormField`

**Erro**: `StepIdentificacao.tsx` usava `<FormLabel>` como cabeçalho de uma seção ("Endereço Atual da Sede"), fora de qualquer `<FormField>`/`<FormItem>`. `npm run build` e `npm run lint` passaram normalmente (é só um erro de runtime), mas a página quebrava (`Error: useFormField should be used within <FormField>`) assim que renderizada — só apareceu num smoke test manual do dev server.
**Causa raiz**: `components/ui/form.tsx` (`FormLabel`/`FormControl`/`FormMessage`/`FormDescription`) chamam `useFormField()`, que lança se não houver `FormFieldContext`/`FormItemContext` no pai — ou seja, esses componentes só podem ser usados **dentro do `render` de um `<FormField>`**, nunca como rótulo solto de uma seção/grupo. Build e lint do Next/ESLint não capturam esse erro porque é puramente de runtime (contexto React ausente), não de tipos.
**Regra**: para cabeçalhos de seção/grupo que não são o rótulo de um campo específico (ex.: "Endereço Atual da Sede", "Dados do Sócio"), usar `<Label>` de `@/components/ui/label` (sem dependência de contexto) ou uma tag semântica (`<h3>`/`<h4>`), nunca `<FormLabel>`/`<FormControl>`/`<FormMessage>` fora de um `<FormField>`. Como isso não aparece no build/lint, **sempre validar páginas novas com formulário num dev server real** (mesmo que via `curl` simples) antes de declarar a fase concluída — ver también a regra geral do CLAUDE.md de testar mudanças de UI no navegador.
