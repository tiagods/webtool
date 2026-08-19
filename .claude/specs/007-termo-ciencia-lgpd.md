---
id: "007"
title: "Termo de Ciência LGPD"
status: done
created: 2026-06-30
author: "Claude"
batch_size: "small"
depends_on: ["006"]
---

# Termo de Ciência LGPD

## Contexto

> A plataforma coleta documentos com dados pessoais sensíveis (RG, CPF, IRPF, endereço) de todos os sócios para abertura e alteração de empresas. Pela LGPD (Art. 7, §5º), o controlador deve ser capaz de **provar** que o titular foi informado e concordou com o tratamento dos seus dados. A base legal utilizada é **execução de contrato** (Art. 7, V) — não consentimento livre — o que significa que, sem o aceite, o serviço não pode ser prestado.
>
> Atualmente não existe nenhuma tela ou registro de ciência. O checkbox `documentosAceitos` no final do formulário não cumpre esse papel: não informa a base legal, não registra timestamp/IP, não bloqueia o início do processo.
>
> O gate precisa cobrir **os dois fluxos** (Abertura e Alteração), não só `/abertura` — por isso o modal é montado no layout raiz (`apps/web/app/layout.tsx`), que envolve a Página Inicial (Spec 006) e qualquer fluxo que a partir dela seja iniciado. Esta spec depende da 006 já existir como ponto de entrada.

## Objetivo

> Implementar um **Termo de Ciência** que:
> 1. É apresentado antes de qualquer processo (abertura ou alteração) começar
> 2. Informa claramente quais dados são coletados, por quê, por quanto tempo e com qual base legal
> 3. Registra o aceite no servidor com prova auditável (`sessionId`, `versaoTermo`, `timestamp`, `ip`, `userAgent`)
> 4. Bloqueia o formulário enquanto não houver aceite registrado na sessão
> 5. Permite ao usuário recusar — com mensagem clara de que o serviço não pode ser prestado — e voltar atrás a qualquer momento

## Fora de escopo

- Gestão de conta de usuário (login, perfil) — usuário é identificado pela sessão JWT
- Versioning automático do termo — versão é hardcoded `v1.0` nesta spec
- Invalidação de aceites antigos ao mudar o termo — implementado manualmente (alterar `TERMO_VERSAO_ATUAL`)
- Fluxo de revogação de aceite pós-submissão
- E-mail de confirmação do aceite

## Design

### Fluxo

```
GET /  (ou /abertura, /alteracao — qualquer rota)
      ↓
Middleware verifica cookie de aceite
      ↓
Tem aceite registrado para versão atual? ──sim──→ carrega a página normalmente
      ↓ não
Layout raiz mostra modal "Termo de Ciência" (bloqueante, sem fechar clicando fora)
      ↓
[ Recusar ]                        [ Li e estou ciente ]
      ↓                                      ↓
Mostra tela de recusa               POST /api/aceite-termo
com contato Prolink                         ↓
      ↓                            Salva RegistroAceite no DynamoDB
[ Revisar e aceitar ]               Set cookie aceite_termo=<token>
      ↓                                      ↓
Volta pro modal                     Fecha modal → página liberada (Início, Abertura ou Alteração)
```

### Conteúdo do Termo

```
Tratamento de Dados Pessoais — Prolink Contabilidade

Para realizar a abertura/alteração da sua empresa, precisamos
coletar e processar dados pessoais dos sócios, incluindo:

• Documentos de identificação (RG, CPF)
• Comprovante de residência
• Declarações de IR (IRPF)
• Dados de contato e qualificação

Finalidade: exclusivamente para a prestação do serviço contratado.
Retenção: 5 anos (prazo legal contábil).
Base legal: Art. 7, V da LGPD — execução de contrato.

→ Ver Política de Privacidade completa

☐ Li e estou ciente do tratamento dos meus dados
  para fins de abertura/alteração de empresa.
```

### Camadas afetadas

| Camada | Arquivo | Ação |
|--------|---------|------|
| Component | `apps/web/components/TermoCienciaModal.tsx` | CREATE |
| API | `apps/web/app/api/aceite-termo/route.ts` | CREATE |
| Middleware | `apps/web/middleware.ts` | CREATE |
| Layout | `apps/web/app/layout.tsx` | MODIFY — já existe (Spec 001); monta o modal condicionalmente |
| Shared | `packages/shared/src/schemas/aceite.ts` | CREATE |

### Contratos / Interfaces

```ts
// packages/shared/src/schemas/aceite.ts

interface RegistroAceite {
  sessionId:   string   // JWT sub — identifica a sessão
  versaoTermo: string   // "v1.0"
  aceitoEm:   string   // ISO 8601 timestamp
  ip:          string   // x-forwarded-for ou socket.remoteAddress
  userAgent:   string   // navigator.userAgent via header
}

// DynamoDB: tabela "fichas-abertura", item separado
// PK: sessionId  |  SK: "aceite#v1.0"
```

```ts
// POST /api/aceite-termo
// Body: { versaoTermo: string }
// Response: { ok: true }
// Side effects:
//   - Salva RegistroAceite no DynamoDB
//   - Seta cookie httpOnly "prolink_aceite" com JWT (sessionId + versao)
```

```ts
// middleware.ts
// Rotas protegidas: todas (/, /abertura/**, /alteracao/**), exceto /api/aceite-termo e assets estáticos
// Se não tiver cookie "prolink_aceite" válido → flag para o layout raiz mostrar modal
// (não redireciona — o modal bloqueia in-place, sobre a Página Inicial (Spec 006) ou o fluxo em andamento)
```

### Tela de recusa

Quando o usuário recusa, o modal é substituído por uma tela simples:

```
Não é possível continuar

O tratamento dos seus dados é necessário para prestar
o serviço de abertura de empresa. Sem isso, não
conseguimos processar sua solicitação.

Ficou com dúvidas? Entre em contato:
📧 contato@prolinkcontabil.com.br

[ Revisar e aceitar ]
```

## Critérios de aceite

- [x] `TermoCienciaModal` exibido antes de qualquer conteúdo em `/`, `/abertura` ou `/alteracao`
- [x] Modal é bloqueante: não fecha ao clicar fora, não tem botão X
- [x] Checkbox habilitado apenas após rolar até o final do texto (ou leitura mínima de 3s)
- [x] Botão "Li e estou ciente" só fica ativo quando checkbox marcado
- [x] `POST /api/aceite-termo` salva `RegistroAceite` no DynamoDB
- [x] Cookie `prolink_aceite` setado como httpOnly após aceite
- [x] Após aceite, modal fecha e a página (Início/Abertura/Alteração) é liberada sem refresh
- [x] Tela de recusa exibida ao clicar "Recusar", com botão para voltar ao modal
- [x] Middleware verifica cookie nas rotas protegidas e sinaliza ausência de aceite para o layout raiz
- [x] Aceite persiste entre recargas (cookie sobrevive ao refresh)
- [x] Lint passando (`npm run lint`)
- [x] Build sem erros (`npm run build`)

## Notas

- O gate vive no layout raiz (não em `/abertura/layout.tsx`) para cobrir a Página Inicial (Spec 006) e qualquer fluxo futuro (`/alteracao`) sem duplicar lógica
- A versão do termo (`TERMO_VERSAO_ATUAL = "v1.0"`) é uma constante em `lib/termo.ts` — alterar para invalidar aceites antigos
- O cookie `prolink_aceite` é separado do cookie de sessão (`prolink_session`) — propósitos distintos
- **Implementado**: o `RegistroAceite` é gravado em uma tabela dedicada `prolink-aceites-lgpd` (PK `sessionId`, SK `versaoTermo`), separada de `fichas-abertura` — evita colidir com o item de rascunho que a Spec 008 grava sob a mesma PK `sessionId`. Ver `apps/web/lib/aws/dynamodb.ts` e `infra/local/init.sh`.
- Não usar consentimento como base legal — o termo deve deixar claro que é **execução de contrato** (Art. 7, V LGPD)
- Checkbox com "parede de texto" sem leitura mínima pode ser questionado — o delay de 3s ou scroll-to-end é uma proteção extra
