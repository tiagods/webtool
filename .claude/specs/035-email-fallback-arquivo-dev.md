---
id: "035"
title: "E-mail de notificação: SMTP opcional em dev com fallback para arquivo HTML"
status: in-progress
created: 2026-09-23
author: "Tiago"
batch_size: "small"
depends_on: []
prefer_after: []
touches:
  - "apps/backend/infrastructure/config/**"
  - "apps/backend/infrastructure/email/**"
  - "apps/backend/infrastructure/worker_controller.go"
  - "docker-compose.yml"
  - ".env.example"
  - "docs/aws.md"
---

# E-mail de notificação: SMTP opcional em dev com fallback para arquivo HTML

## Contexto

Hoje os seis `SMTP_*` são **obrigatórios em qualquer ambiente** (`required,notEmpty` em
`config.go` e `${VAR:?...}` no `docker-compose.yml` de dev). Consequências:

- O worker **não sobe em dev** sem um servidor SMTP configurado — quem está apenas
  desenvolvendo o fluxo de abertura/alteração precisa de SMTP para ver a notificação.
- A `API` também falha no boot sem `SMTP_*`, mesmo não enviando e-mail (dívida registrada
  na spec 021: "config.Load exige SMTP_* mesmo para a API").
- O `docker-compose.yml` da árvore já tem edições não commitadas nesta direção
  (SMTP relaxado + healthcheck do Floci sem `curl`) que esta spec conclui e ajusta.

## Objetivo

Tornar o envio por SMTP **opcional fora de produção**, espelhando o padrão já usado por
`AWS_ENDPOINT_URL` (ausente → comportamento de fallback, presente → caminho completo):

- **`SMTP_HOST` preenchida** (qualquer env) → modo SMTP: envia por e-mail como hoje.
- **`SMTP_HOST` ausente + `APP_ENV=dev`** → modo arquivo: o worker **grava o corpo HTML já
  renderizado** num arquivo no diretório temp do SO (`os.TempDir()` — `/tmp` no container
  Linux, `%TEMP%` rodando Go direto no Windows), em vez de enviar e-mail. O fluxo de
  submissão não quebra e nada é escrito dentro do repositório.
- **`SMTP_HOST` ausente + `APP_ENV=prod`** → **boot falha rápido** com erro agregado —
  produção exige SMTP estritamente.

O modo arquivo reusa a implementação da interface `outbound.EmailSender` (sem tocar no
domain/service): nova implementação `FileMailer` em `infrastructure/email` que persiste
`EmailData.BodyHTML` — o mesmo HTML que iria para o e-mail, renderizado pelos templates
existentes (`html/template` embutidos). Não há segundo conjunto de templates.

## Fora de escopo

- Mudar o conteúdo/estilo dos e-mails ou dos templates existentes.
- Envio de e-mail em produção sem SMTP (impossível por design).
- UI/frontend para visualizar os arquivos gerados.
- `docker-compose.prod.yml` e task defs Fargate: **sem mudança funcional** (SMTP continua
  `:?` obrigatório em prod; o fail-fast no Go passa a ser a segunda barreira).
- Anexos MIME no e-mail (continua presigned URL no corpo — ver spec 013).

## Design

### Decisão de modo (regra única)

| `SMTP_HOST` | `APP_ENV` | Resultado |
|-------------|-----------|-----------|
| preenchida  | dev/prod  | **modo SMTP** — exige ainda `SMTP_FROM` e `SMTP_TO` (erro agregado se faltarem); `SMTP_USER`/`SMTP_PASSWORD` opcionais (`UsesAuth()`); `SMTP_PORT` default `587` no Go |
| ausente     | `prod`    | **erro no boot** — SMTP é estritamente obrigatório em produção |
| ausente     | `dev`     | **modo arquivo** — `FileMailer` grava HTML em `EMAIL_OUTPUT_DIR` |

### Camadas afetadas

| Camada | Arquivo | Ação |
|--------|---------|------|
| Config | `apps/backend/infrastructure/config/config.go` | EDIT — SMTP deixa de ser `required`; validação condicional; `EmailOutputDir` |
| Config | `apps/backend/infrastructure/config/config_test.go` | EDIT — casos dev sem SMTP, prod sem SMTP, SMTP parcial |
| Infra (email) | `apps/backend/infrastructure/email/file_mailer.go` | CREATE — `FileMailer` |
| Infra (email) | `apps/backend/infrastructure/email/file_mailer_test.go` | CREATE — testes unitários |
| Infra (wiring) | `apps/backend/infrastructure/worker_controller.go` | EDIT — escolhe o `EmailSender` e loga o modo |
| Compose (dev) | `docker-compose.yml` | EDIT — SMTP interpolado sem obrigatoriedade; api sem SMTP |
| Env sample | `.env.example` | EDIT — bloco SMTP marcado como opcional em dev |
| Docs | `docs/aws.md` | EDIT — SMTP obrigatório só em prod; documentar fallback |

### Contratos / Interfaces

```go
// config.go — SMTP ganha:
func (s SMTP) Configured() bool { return s.Host != "" }

// Config ganha:
EmailOutputDir string // env:"EMAIL_OUTPUT_DIR" (opcional, override);
//   default = os.TempDir() → /tmp no container Linux, %TEMP% no Windows
//   (resolvido pós-parse em config.go, pois envDefault é string estática)

// file_mailer.go — nova implementação do port existente (domain inalterado):
type FileMailer struct{ dir string }
func NewFileMailer(dir string) *FileMailer
func (m *FileMailer) Send(ctx context.Context, data outbound.EmailData) error
//   MkdirAll(dir); grava data.BodyHTML em <dir>/<ts-utc>_<slug-do-Subject>.html;
//   colisão no mesmo segundo → sufixo -2, -3...; loga o path (slog.Info).

// worker_controller.go — wiring:
var mailer outbound.EmailSender
if cfg.SMTP.Configured() {
    mailer = infraemail.NewSMTPMailer(cfg.SMTP)
} else {
    mailer = infraemail.NewFileMailer(cfg.EmailOutputDir)
}
// slog "worker iniciado" ganha "email_mode": "smtp"|"file"
```

### Compose dev (`docker-compose.yml`)

- `worker`: `SMTP_HOST: ${SMTP_HOST}` etc. (interpolação simples — ausente vira string
  vazia → modo arquivo). **Sem defaults silenciosos** de `SMTP_FROM`/`SMTP_TO` (fallback
  silencioso é o que a spec 030 eliminou); `SMTP_PORT` pode sair do compose (default 587
  no Go).
- `worker` não ganha env/volume novos: o default `os.TempDir()` já resolve para `/tmp`
  dentro do container (Linux). O worker loga o path completo de cada arquivo gerado
  (INFO); para inspecioná-lo: `docker exec prolink-worker ls /tmp` ou `docker cp`.
- `api`: **não recebe variáveis SMTP** (não envia e-mail; a config deixa de exigí-las em
  dev — resolve a dívida da spec 021). As SMTP adicionadas à api na árvore são removidas.
- Mantém o healthcheck do Floci sem `curl` (`bash -c 'exec 3<>/dev/tcp/...'`) já presente
  na árvore — a imagem `floci/floci:latest` não traz `curl`.
- Nada é escrito dentro do repositório → sem mudança no `.gitignore`.
- `docker-compose.prod.yml`: inalterado (SMTP `:?` obrigatório).

### Erros de validação (fail-fast, agregado)

- `SMTP_HOST` sem `SMTP_FROM`/`SMTP_TO` (qualquer env): erro listando as ausentes.
- `APP_ENV=prod` sem `SMTP_HOST`: erro "SMTP é obrigatório em produção" + lista.
- O boot nunca retorna `Config` parcial (comportamento atual preservado).

## Critérios de aceite

- [ ] Dev: worker sobe **sem nenhuma** `SMTP_*` e loga `email_mode: file`.
- [ ] Dev: mensagem de submissão processada gera arquivo `.html` no diretório temp do SO
  (`/tmp` no container) com o mesmo corpo que o e-mail (templates existentes) e nome com
  timestamp + protocolo.
- [ ] Dev: com `SMTP_HOST`+`FROM`+`TO` preenchidas → modo SMTP (caminho atual), sem arquivo.
- [ ] Dev: `SMTP_HOST` sem `FROM`/`TO` → boot falha com erro agregado.
- [ ] Prod (`APP_ENV=prod`) sem `SMTP_HOST` → boot falha citando SMTP.
- [ ] Nenhum arquivo de notificação cai dentro do repositório (`git status` limpo após
  processar).
- [ ] `api` sobe em dev sem variáveis SMTP (dívida da spec 021 resolvida).
- [ ] Docs: `docs/aws.md` e `.env.example` refletem "SMTP obrigatório só em prod".
- [ ] Gates do escopo tocado verdes:
  - `apps/backend/**` → `make -C apps/backend lint` + `make -C apps/backend test` +
    `docker compose build api worker`
  - `docker-compose.yml` → `docker compose config -q` (interpolação válida)

## Notas

- **Teste de paralelismo (execucao-paralela.md §1): SEQUENCIAL.** Partições Go ×
  compose/docs existem e o contrato é nomeável (nomes de env + regra de modo), mas o bloco
  compose/docs é trivial (edições de 1–3 linhas em ~5 arquivos) — custo de despacho/revisão
  > ganho; o gate final do worker também serializa. Na dúvida, sequencial.
- O service `NotificarSubmissao` não muda: continua renderizando e chamando
  `EmailSender.Send` — a escolha SMTP × arquivo é wiring em `worker_controller.go`.
- `FileMailer` ignora `EmailData.To` (em dev o destinatário é a pasta local).
- Nome de arquivo: `<YYYYMMDDTHHMMSSZ>_<slug-Subject>.html`, slug = não-alfanumérico → `-`
  (o Subject carrega "Nova abertura/alteração — PROTOCOLO").
- Estado da árvore: `docker-compose.yml` já tem edições não commitadas desta spec
  (relaxamento SMTP, SMTP na api, healthcheck Floci) — o batch as conclui/ajusta e o
  commit único da infra parte desse estado.
