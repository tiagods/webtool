---
id: "039"
title: "Auditoria dos ports: inbound/outbound e recursos fora do lugar em infrastructure"
status: done    # draft | review | approved | in-progress | done | rejected
created: 2026-10-06
author: "Tiago"
batch_size: "medium"   # small (≤ meio dia) | medium (≤1 dia)
depends_on: []         # HARD - sem estas specs a mudanca nao compila/nao faz sentido
prefer_after: []       # ordem preferida - apenas avisa, nunca bloqueia
touches:               # globs dos paths que a spec altera - detecta colisao entre worktrees
  - "apps/backend/domain/ports/**"
  - "apps/backend/domain/service/**"
  - "apps/backend/adapter/web/**"
  - "apps/backend/infrastructure/email/**"
  - "apps/backend/infrastructure/middleware/**"
  - "apps/backend/infrastructure/testhelpers/**"
  - "apps/backend/infrastructure/worker_controller.go"
  - "apps/backend/infrastructure/worker_integration_test.go"
  - ".claude/rules/boas-praticas-go.md"
  - ".claude/specs/039-*.md"
---

# Auditoria dos ports: inbound/outbound e recursos fora do lugar em infrastructure

## Contexto

Um port **inbound** recebe o que vem de fora para dentro do domínio (casos de uso chamados
pelos handlers); um port **outbound** é o que o domínio chama para alcançar sistemas externos
(repositórios, storage, publishers, e-mail). A regra de dependência de
`.claude/rules/boas-praticas-go.md` §1/§5 assume essa divisão, mas o código de `apps/backend`
não a segue por inteiro. Levantamento em `main` (`cb61d9a`):

1. **`domain/ports/inbound/` não existe.** Só há `domain/ports/outbound/` (7 interfaces). Os
   handlers, o `router.go` e os guards recebem os services como **struct concreta**
   (`*service.AceiteService`, `*service.SessaoService`, … em `adapter/web/handler/handlers.go`,
   `adapter/web/router.go` e `infrastructure/middleware/guard.go`), embora a regra diga que
   `domain/service` "implementa ports/inbound".
2. **O domínio importa `infrastructure`.** `domain/service/notificar.go` importa
   `infrastructure/email` para usar `DadosEmailAbertura`, `DadosEmailAlteracao`, `SocioEmail`,
   `DocLink`, `RenderAbertura`, `RenderAlteracao` e `FormatarDataHora` — violação direta de
   "`domain/` nunca importa `infrastructure/`". O service renderiza HTML e monta o assunto,
   trabalho que é do adapter de e-mail.
3. **O contrato de `outbound.EmailSender` está no nível errado.** `EmailData` carrega
   `To`/`Subject`/`BodyHTML` — o formato do canal SMTP —, enquanto o objeto que de fato cruza a
   fronteira de saída (os dados da notificação) mora em `infrastructure/email`. Além disso:
   - `EmailData.Documentos` e `AnexoInfo` (com `S3Key`) **nunca são lidos** — código morto;
   - `EmailData.To` duplica `config.SMTP.To`, que é o que o `SMTPMailer` realmente usa no
     `RCPT TO`;
   - `FileMailer` faz parse do assunto (`protocoloDoAssunto`) para recuperar o protocolo.
4. **`infrastructure/email/templates.go` tem estado global**: `var templates` de pacote
   preenchido em `init()` — proibido pelo §5 ("zero estado global").
5. **`*ratelimit.FixedWindow` e `*auth.CookieBuilder` chegam concretos** ao `router.go`, ao
   handler e ao `middleware.RateLimit`.
6. **`outbound.EmailSender` está fora do padrão de mocks**: sem diretiva em
   `ports/outbound/mocks/generate.go`; no lugar há um fake à mão, `MockEmailSender`, em
   `infrastructure/testhelpers/setup.go`.

## Objetivo

Auditar todo struct e interface de `apps/backend/domain/ports` e `apps/backend/infrastructure`
e deixar cada um na camada correta, de modo que:

- exista `domain/ports/inbound/` com os contratos dos casos de uso, **agrupados por entidade**,
  implementados por `domain/service` e consumidos por handlers, router e guards;
- `domain/` não importe nenhum pacote de `infrastructure/`;
- os objetos que cruzam a fronteira de saída do e-mail sejam **tipos do port outbound** — a
  entity trafega só internamente e nunca é o objeto de envio;
- renderização de template, assunto e destinatário fiquem no adapter de e-mail;
- `boas-praticas-go.md` reflita o layout resultante.

Refactor estrutural: **nenhuma mudança de comportamento**, de rota, de contrato JSON nem do
HTML do e-mail.

## Fora de escopo

- Mudar o conteúdo dos templates HTML ou o texto do assunto.
- Novo canal de notificação (evento/SNS) — o contrato fica pronto para isso, a implementação não.
- `adapter/event/consumer` (Phase 7): o consumo SQS segue em `infrastructure/worker_controller.go`.
- Interface para `CookieBuilder` (ver Notas).
- Rate limit distribuído — só a interface do consumidor entra.
- Converter os fakes stateful de `domain/service/fakes_test.go` em mocks gerados.

## Design

### 1. Ports inbound, por entidade

Um arquivo por entidade em `domain/ports/inbound/`. Os dois pares de services de
abertura/alteração têm a mesma assinatura e implementam a **mesma** interface.

| Port (`inbound`) | Métodos | Implementado por |
|---|---|---|
| `AceiteUseCase` | `RegistrarAceite` | `AceiteService` |
| `SessaoUseCase` | `VerificarAceite`, `CriarOuObter`, `RequireSessao`, `EncerrarPorToken`, `Encerrar` | `SessaoService` |
| `RascunhoUseCase` | `Buscar`, `Salvar` | `RascunhoService`, `AlteracaoRascunhoService` |
| `DocumentoUseCase` | `ValidarPedido`, `PresignarDocumento`, `ConfirmarUpload` | `UploadService` |
| `SubmissaoUseCase` | `Submeter` | `SubmitService`, `AlteracaoSubmitService` |
| `NotificacaoUseCase` | `Processar` | `NotificarSubmissao` |

- `ConfirmarUpload` sai de `RascunhoService` e vai para `UploadService` (que passa a receber
  também o `RascunhoRepository`): é operação da entidade documento, e assim `RascunhoUseCase`
  serve aos dois formulários sem método sobrando.
- `service.SessaoResult` é o retorno de um port → move para `inbound.SessaoResult`.
- Cada service ganha a asserção `var _ inbound.XxxUseCase = (*XxxService)(nil)`.
- `handler.Handlers`, `web.Deps`, `middleware.GuardAceite`/`GuardSessao` e o loop do worker
  passam a receber as interfaces. `StartApp` e `testhelpers` continuam construindo os services
  concretos — a atribuição é implícita, sem mudança no wiring.
- Mocks gerados em `ports/inbound/mocks/` (um por interface, mesmo padrão do outbound).

### 2. E-mail: o objeto de envio é do port outbound

```go
// domain/ports/outbound/notificacao.go (substitui email.go)

// NotificacaoSender entrega a notificação de uma submissão ao canal configurado.
type NotificacaoSender interface {
	EnviarAbertura(ctx context.Context, n NotificacaoAbertura) error
	EnviarAlteracao(ctx context.Context, n NotificacaoAlteracao) error
}

type NotificacaoAbertura struct { /* campos de DadosEmailAbertura */ }
type NotificacaoAlteracao struct { /* campos de DadosEmailAlteracao */ }
type SocioNotificacao struct { /* campos de SocioEmail */ }
type DocumentoLink struct{ Label, URL string }
```

- `DadosEmailAbertura`, `DadosEmailAlteracao`, `SocioEmail` e `DocLink` saem de
  `infrastructure/email` e viram os tipos acima em `ports/outbound`.
- `EmailData` e `AnexoInfo` são removidos (o `S3Key` morto vai junto).
- `DataHora` vira `time.Time` no contrato; a formatação para exibição fica no adapter.
- `NotificarSubmissao` só extrai o payload, gera os links e chama `EnviarAbertura`/
  `EnviarAlteracao`. Perde o parâmetro `to` e o import de `infrastructure/email`.
- `infrastructure/email`: um `Renderer` construído por `NewRenderer()` (parse do `embed.FS` no
  construtor, com erro — sem `init()` nem `var` de pacote) compartilhado por `SMTPMailer` e
  `FileMailer`. Cada mailer monta o assunto e renderiza o corpo; o destinatário vem de
  `config.SMTP.To`. `FileMailer` lê o protocolo do DTO, e `protocoloDoAssunto` some.
- `MockEmailSender` é removido; entra `mocks/notificacao_sender.go` gerado. O teste de
  integração do worker captura o DTO via `EXPECT().EnviarAbertura(...).DoAndReturn(...)` e
  passa a afirmar sobre os campos da notificação; a afirmação sobre o HTML renderizado migra
  para um teste unitário do `Renderer`.

### 3. Rate limit

`infrastructure/middleware` declara a interface que consome:

```go
// Limitador decide se a chave ainda pode fazer requisições na janela corrente.
type Limitador interface{ Permitir(chave string) bool }
```

`middleware.RateLimit` e `web.Deps.RateLimit` passam a receber `Limitador`;
`ratelimit.FixedWindow` já o satisfaz. Não é port de domínio — o domínio não conhece rate limit.

### Camadas afetadas

| Camada | Arquivo | Ação |
|--------|---------|------|
| Ports inbound | `domain/ports/inbound/{aceite,sessao,rascunho,documento,submissao,notificacao}.go` | CREATE |
| Ports inbound | `domain/ports/inbound/mocks/*` | CREATE (gerado) |
| Ports outbound | `domain/ports/outbound/notificacao.go` | CREATE |
| Ports outbound | `domain/ports/outbound/email.go` | DELETE |
| Ports outbound | `domain/ports/outbound/mocks/{generate.go,notificacao_sender.go}` | MODIFY / CREATE (gerado) |
| Service | `domain/service/{sessao,rascunho,upload}.go` + testes | MODIFY |
| Service | `domain/service/notificar.go` | MODIFY |
| Service | demais services (asserção de interface) | MODIFY |
| Adapter web | `adapter/web/router.go`, `adapter/web/handler/handlers.go` + handlers de upload/sessão | MODIFY |
| Infra | `infrastructure/middleware/{guard,ratelimit}.go` | MODIFY |
| Infra | `infrastructure/email/{templates,smtp,file_mailer,file_mailer_test}.go` | MODIFY |
| Infra | `infrastructure/email/renderer_test.go` | CREATE |
| Infra | `infrastructure/worker_controller.go`, `worker_integration_test.go`, `testhelpers/setup.go` | MODIFY |
| Regras | `.claude/rules/boas-praticas-go.md` (§1, §5, §12) | MODIFY |

## Blocos

`make generate` é recurso exclusivo: roda no orquestrador depois que `@inbound` e
`@notificacao` existem.

`controller.go` entra em B1 porque a mudança de assinatura de `NewUploadService`
(`RascunhoRepository` a mais) é dele. Os itens de `notificar.go`/
`worker_controller.go`/`testhelpers` do B2 só compilam com o pacote `inbound` existindo:
B2 executa a metade e-mail/outbound primeiro e fecha a metade worker após `@inbound`.

| # | Bloco | owns | needs | emite | agente |
|---|-------|------|-------|-------|--------|
| B1 | Ports inbound + services | `apps/backend/domain/ports/inbound/**`, `apps/backend/domain/service/**` exceto `notificar.go`, `apps/backend/infrastructure/controller.go` | — | `@inbound` | claude |
| B2 | Contrato de notificação + adapter de e-mail | `apps/backend/domain/ports/outbound/**`, `apps/backend/domain/service/notificar.go`, `apps/backend/infrastructure/email/**`, `apps/backend/infrastructure/worker_controller.go`, `apps/backend/infrastructure/worker_integration_test.go`, `apps/backend/infrastructure/testhelpers/**` | — | `@notificacao` | claude |
| B3 | Adapter web + middleware | `apps/backend/adapter/web/**`, `apps/backend/infrastructure/middleware/**` | `@inbound` | — | claude |
| B4 | Regras | `.claude/rules/boas-praticas-go.md` | — | — | claude |

## Critérios de aceite

- [x] `domain/ports/inbound/` existe com os 6 ports da tabela; cada service tem a asserção de
      interface correspondente
- [x] Nenhum arquivo fora de `infrastructure/{controller,worker_controller}.go`,
      `testhelpers` e `*_test.go` referencia `*service.XxxService` — handlers, router e guards
      dependem só de `inbound.*`
- [x] `grep -r "backend/infrastructure" apps/backend/domain` não retorna nada
- [x] `outbound.EmailData`, `outbound.AnexoInfo`, `testhelpers.MockEmailSender` e
      `protocoloDoAssunto` não existem mais
- [x] `infrastructure/email` não tem `init()` nem `var` de pacote com template
- [x] `outbound.NotificacaoSender` tem mock gerado e `make generate` não deixa diff
- [x] O HTML dos e-mails de abertura e de alteração é byte a byte igual ao de `main` para o
      mesmo payload (teste do `Renderer` com golden gerado em `main`, `DataHora` fixa)
- [x] `middleware.RateLimit` recebe `Limitador`
- [x] `boas-praticas-go.md` atualizado: `inbound` pode importar `domain/validation`; objetos de
      fronteira de saída vivem em `ports/outbound`; `Limitador` e `CookieBuilder` registrados
- [x] Gates do escopo tocado verdes (ver tabela em `.claude/commands/done.md`):
  - `apps/backend/**` → `make -C apps/backend lint` + `make -C apps/backend test` + `docker compose build api-go`
  - `make -C apps/backend test-integration` (o diff toca o teste de integração do worker)
    - Nota: `test`/`test-integration` só falham em 3 casos pré-existentes também presentes em
      `main` (validator não rejeita chave de topo desconhecida — `TestRascunhoService_Salvar`,
      `TestAlteracaoRascunhoService_Salvar`, `TestPostDraft/chave_de_topo_desconhecida`), fora do
      escopo deste spec. Nenhum teste novo do diff 039 quebrou; o pacote `infrastructure`
      (integração do worker) passa.

## Notas

- **Tamanho — uma spec só.** Analisada a seção de e-mail: são ~9 arquivos num pacote
  pequeno, sem tocar AWS nem rotas (~meio dia). Os ports inbound são mecânicos (~meio dia). As
  duas partes têm `owns` disjuntos, então cabem em 1 dia em paralelo. Se preferir duas specs, o
  corte natural é B1+B3 / B2.
- **`CookieBuilder` fica concreto.** Só o handler o usa, não faz I/O, tem uma implementação só
  e devolve `*http.Cookie` — não pode ser port de domínio e uma interface não compraria nada.
- **`FixedWindow` ganha interface** porque o próprio pacote já anuncia a segunda implementação
  (contador compartilhado para multi-instância) e o contrato é de um método.
- **`inbound` importa `domain/validation`**: `Salvar` e `Submeter` devolvem
  `[]validation.Issue`. A regra atual ("entity + stdlib apenas") precisa dessa exceção.
- **Sufixo `UseCase`** nos ports inbound é proposta — trocar aqui se preferir outro nome.
- **Teste de integração do worker**: com o mock gerado ele deixa de ver HTML e passa a afirmar
  sobre o DTO; a cobertura do HTML vai para o teste unitário do `Renderer`.
