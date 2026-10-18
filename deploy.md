# Guia de Deploy - Prolink Webtool

Desde a [Spec 009](.claude/specs/009-separacao-frontend-backend.md), o projeto é composto por um frontend (`apps/web`, Next.js) e um backend (`apps/backend`) separados atrás de um Nginx. Desde as specs 022–029 o backend é um **binário Go** (`cmd/api`, Echo + Clean Architecture) — a reescrita substituiu a implementação Next.js original.

A produção roda numa **instância AWS Lightsail** com Docker, usando `docker-compose.prod.yml`: as imagens são buildadas no próprio servidor (sem container registry), o Caddy termina TLS com Let's Encrypt e o Nginx roteia para `web`/`api`. Os recursos gerenciados (DynamoDB, S3, SQS) ficam na mesma conta AWS.

---

## Deploy no Lightsail (Docker Compose)

### Passo 0: Provisionar os recursos AWS

A partir de uma máquina autenticada por **role assumida** (SSO/`assume-role`):

```bash
export AWS_REGION=us-east-1
export PROD_ORIGIN=https://prolinkcontabil.com.br

./infra/aws/provision-dynamodb.sh
./infra/aws/provision-s3.sh
./infra/aws/provision-sqs.sh
```

**Credenciais da aplicação:** instâncias Lightsail **não suportam IAM role/instance profile**, então `api` e `worker` acessam a AWS por **access key de IAM user**. São dois users, um por serviço, com as permissões de menor privilégio descritas em [`docs/aws.md`](docs/aws.md#iam--credenciais-da-aplicação) (`ApiApp` e `WorkerApp`). As chaves são geradas pelo operador (`aws iam create-access-key --user-name <user>`) e vão **apenas** no `.env` do servidor — nunca no repositório.

### Passo 1: Preparar o servidor

1. Crie a instância Lightsail (Linux) e anexe um **IP estático** a ela (gratuito enquanto anexado — não muda em restart).
2. Acesse o servidor via SSH.
3. Instale o Docker e o Docker Compose plugin (ex.: [guia oficial](https://docs.docker.com/engine/install/)).
4. **Configure o firewall** (pré-requisito de segurança, fora do escopo do Docker/Compose) — no **firewall da instância Lightsail** (aba *Networking*) e, como segunda camada, no `ufw` do host:
   - Libere as portas **80** e **443** (o Caddy do Passo 4 termina TLS nessas portas) para a internet, além da **22** (SSH).
   - **Bloqueie a porta 3001 externamente.** O `docker-compose.prod.yml` publica `3001:3001` no host (útil para debug via SSH/túnel local), mas essa porta nunca deve ser alcançável pela internet — é o processo com acesso direto a DynamoDB/S3/SQS. Exemplo com `ufw`:
     ```bash
     sudo ufw allow 80/tcp
     sudo ufw allow 443/tcp
     sudo ufw deny 3001/tcp
     sudo ufw enable
     ```
5. Crie o **`.env` não versionado** na raiz do projeto (lido pelo Compose) com os segredos e as credenciais da aplicação. Nunca o versione:
   - `JWT_SECRET`, `SMTP_PASSWORD` (e os demais `SMTP_*`, `AWS_SQS_QUEUE_URL`);
   - `API_AWS_ACCESS_KEY_ID` / `API_AWS_SECRET_ACCESS_KEY` — chave do user `ApiApp`;
   - `WORKER_AWS_ACCESS_KEY_ID` / `WORKER_AWS_SECRET_ACCESS_KEY` — chave do user `WorkerApp`.

   O Compose repassa a cada serviço só a sua chave, como `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`. Sem `AWS_ENDPOINT_URL`, o SDK Go usa a cadeia de credenciais padrão, que lê essas variáveis — nenhuma mudança de código entre dev (Floci) e produção. As demais variáveis (`APP_ENV=prod`, `AWS_REGION`, `AWS_DYNAMODB_ABERTURA_TABLE`, `AWS_DYNAMODB_ALTERACAO_TABLE`, `AWS_DYNAMODB_ACEITES_TABLE`, `AWS_S3_BUCKET`, `AWS_SQS_QUEUE_URL`, `JWT_SECRET` e os seis `SMTP_*`) são injetadas pelo `docker-compose.prod.yml` e são **obrigatórias** (o boot do binário Go falha rápido listando o que faltar).
6. Aponte o DNS do domínio de produção (`prolinkcontabil.com.br` e `www.prolinkcontabil.com.br`) para o IP estático da instância — pré-requisito para a emissão automática do certificado TLS no Passo 4.

### Passo 2: Clonar o projeto

```bash
git clone https://seu-repositorio-git/prolink-webtool.git
cd prolink-webtool
```

### Passo 3: Subir a stack de produção

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Isso builda e sobe quatro containers: `web` (:3000, Next.js), `api` (:3001, binário Go), `nginx` (interno, sem porta publicada) e `caddy` (:80, :443). O Nginx roteia `/` → `web` e `/api/*` → `api` (ver `infra/nginx/default.conf`); o Caddy termina TLS e repassa tudo para o Nginx internamente (ver Passo 4). A aplicação fica disponível em `https://prolinkcontabil.com.br`.

> **Rollback do cutover Go→Node:** `git revert` do commit da migração Go (specs 022–028) restaura a implementação Next.js (`apps/api`) e os serviços antigos de `docker-compose*.yml`. `infra/nginx` não muda em nenhuma direção.

### Passo 4: TLS/HTTPS (Caddy)

O `Caddyfile` na raiz do repositório já está configurado para `prolinkcontabil.com.br` e `www.prolinkcontabil.com.br`, repassando para `nginx:80` internamente:

```
prolinkcontabil.com.br, www.prolinkcontabil.com.br {
	reverse_proxy nginx:80
}
```

Nenhuma ação manual é necessária além do DNS e do firewall (ver itens 4 e 6 do Passo 1): ao subir a stack com `docker compose -f docker-compose.prod.yml up -d --build`, o Caddy emite e renova o certificado Let's Encrypt automaticamente (HTTP-01 challenge na porta 80, sem Certbot/cron). Os certificados ficam persistidos no volume `caddy_data` entre restarts/updates.

Se o domínio de produção mudar, edite o `Caddyfile` antes de subir a stack novamente.

### Atualizações

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Alternativa: Vercel (apenas para `apps/web`)

A Vercel é adequada para hospedar `apps/web` isoladamente (CDN global, SSL automático, deploy por push), mas **não é recomendada para `apps/backend`** nesta arquitetura: o objetivo da Spec 009 é justamente manter o backend fora de acesso público direto via firewall, o que a Vercel (serverless, sempre publicamente acessível) não permite replicar. Além disso, `apps/backend` agora é um binário Go — não um app Next.js que a Vercel hospeda nativamente. Se optar por esse caminho:

- **Root Directory**: `apps/web`
- **Framework Preset**: Next.js (detectado automaticamente)
- `apps/backend` (Go) precisaria ser hospedado à parte (Lightsail, Cloud Run, Fly.io, etc.), e `apps/web` apontaria os rewrites para a URL pública desse serviço (não para `localhost:3001`).
