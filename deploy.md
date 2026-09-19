# Guia de Deploy - Prolink Webtool

Desde a [Spec 009](.claude/specs/009-separacao-frontend-backend.md), o projeto é composto por um frontend (`apps/web`, Next.js) e um backend (`apps/backend`) separados atrás de um Nginx. Desde as specs 022–029 o backend é um **binário Go** (`cmd/api`, Echo + Clean Architecture) — a reescrita substituiu a implementação Next.js original.

Há dois caminhos de deploy:

1. **AWS Fargate (alvo)** — `api` e `worker` como tasks ECS com **IAM Task Role** (sem credenciais estáticas) e segredos no **Secrets Manager**. Ver "Deploy em AWS Fargate".
2. **Docker Compose em um host único (alternativa/legado)** — VPS, Lightsail, EC2, etc. Ver "Deploy via Docker Compose".

---

## Deploy em AWS Fargate (recomendado)

O provisionamento dos recursos, roles, segredos e task definitions é feito pelos scripts de [`infra/aws/`](infra/aws/README.md). **Não há credenciais AWS estáticas** em produção: as tasks usam a **Task Role** resolvida pelo SDK Go via metadata do container, e os segredos vêm do Secrets Manager.

### Passo 1: Publicar as imagens no ECR

As imagens são produzidas pelo `apps/backend/Dockerfile` (um binário por build arg) e devem ser publicadas no Amazon ECR:

```bash
# uma vez: criar os repositórios
aws ecr create-repository --repository-name prolink-api
aws ecr create-repository --repository-name prolink-worker

# login
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <acct>.dkr.ecr.us-east-1.amazonaws.com

# build + push (api e worker)
docker build -f apps/backend/Dockerfile --build-arg APP=api    -t prolink-api:latest    apps/backend
docker build -f apps/backend/Dockerfile --build-arg APP=worker -t prolink-worker:latest apps/backend
docker tag prolink-api:latest    <acct>.dkr.ecr.us-east-1.amazonaws.com/prolink-api:latest
docker tag prolink-worker:latest <acct>.dkr.ecr.us-east-1.amazonaws.com/prolink-worker:latest
docker push <acct>.dkr.ecr.us-east-1.amazonaws.com/prolink-api:latest
docker push <acct>.dkr.ecr.us-east-1.amazonaws.com/prolink-worker:latest
```

> O pipeline de build/push automatizado é escopo de uma spec futura; por ora o push é manual.

### Passo 2: Provisionar recursos, roles, segredos e task definitions

A partir de uma máquina autenticada por **role assumida** (SSO/`assume-role`):

```bash
export AWS_REGION=us-east-1
export PROD_ORIGIN=https://prolinkcontabil.com.br

./infra/aws/provision-all.sh
```

`provision-all.sh` encadeia DynamoDB, S3, SQS, IAM (+ log groups) e Secrets Manager. Ele **pula** os task definitions se as imagens não forem informadas; para registrá-los:

```bash
API_IMAGE_URI=<acct>.dkr.ecr.us-east-1.amazonaws.com/prolink-api:latest \
WORKER_IMAGE_URI=<acct>.dkr.ecr.us-east-1.amazonaws.com/prolink-worker:latest \
SMTP_HOST=smtp.exemplo.com SMTP_USER=usuario \
  ./infra/aws/register-task-defs.sh
```

Os valores de `JWT_SECRET` e `SMTP_PASSWORD` **não** entram no repositório: `provision-secrets.sh` lê-os do ambiente do operador (ou gera o `JWT_SECRET` na primeira vez e imprime uma única vez) e os grava no Secrets Manager. Detalhes em [`infra/aws/README.md`](infra/aws/README.md).

### Passo 3: Subir os services Fargate

Criar cluster, services (`api`, `worker`, futuramente `web`), ALB/TLS e rede (VPC/subnets) **não** é feito por estes scripts — é escopo da spec de rede (021b). As task definitions `prolink-api` e `prolink-worker` já ficam registradas e prontas para um service.

> **Autenticação:** a task assume a Task Role automaticamente. Nenhuma variável `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` é configurada — o `api.taskdef.json`/`worker.taskdef.json` explicitamente não as inclui.

---

## Deploy via Docker Compose (alternativa)

Caminho para um servidor com Docker instalado (VPS, Lightsail, EC2), usando `docker-compose.prod.yml`. Neste caminho, `api`/`worker` usam a **IAM role da instância** (recomendado em EC2/Lightsail) ou um perfil local — **nunca** chaves estáticas versionadas.

### Passo 1: Preparar o servidor

1. Acesse o servidor via SSH.
2. Instale o Docker e o Docker Compose plugin (ex.: [guia oficial](https://docs.docker.com/engine/install/)).
3. **Configure o firewall do servidor** (pré-requisito de segurança, fora do escopo do Docker/Compose):
   - Libere as portas **80** e **443** (o Caddy do Passo 4 termina TLS nessas portas) para a internet.
   - **Bloqueie a porta 3001 externamente.** O `docker-compose.prod.yml` publica `3001:3001` no host (útil para debug via SSH/túnel local), mas essa porta nunca deve ser alcançável pela internet — é o processo com acesso direto a DynamoDB/S3/SQS. Exemplo com `ufw`:
     ```bash
     sudo ufw allow 80/tcp
     sudo ufw allow 443/tcp
     sudo ufw deny 3001/tcp
     sudo ufw enable
     ```
4. Garanta que a instância tenha uma **IAM role** com acesso a DynamoDB/S3/SQS (em EC2/Lightsail, anexe uma role à instância). Sem `AWS_ENDPOINT_URL`, o SDK Go usa a cadeia de credenciais padrão (metadata da instância) — nenhuma mudança de código entre dev (Floci) e produção. As demais variáveis (`APP_ENV=prod`, `AWS_REGION`, `AWS_DYNAMODB_TABLE`, `AWS_DYNAMODB_ALTERACAO_TABLE`, `AWS_DYNAMODB_ACEITES_TABLE`, `AWS_S3_BUCKET`, `AWS_SQS_QUEUE_URL`, `JWT_SECRET` e os seis `SMTP_*`) são injetadas pelo `docker-compose.prod.yml` e são **obrigatórias** (o boot do binário Go falha rápido listando o que faltar).
5. Os segredos `JWT_SECRET` e `SMTP_PASSWORD` vêm de um **`.env` não versionado** na raiz (lido pelo Compose). Nunca os versione.
6. Aponte o DNS do domínio de produção (`prolinkcontabil.com.br` e `www.prolinkcontabil.com.br`) para o IP público do servidor — pré-requisito para a emissão automática do certificado TLS no Passo 4.
7. Configure o CORS do bucket S3 real, restrito ao domínio de produção:
   ```bash
   PROD_ORIGIN=https://prolinkcontabil.com.br ./infra/aws/set-cors-producao.sh
   ```
   Esse wrapper delega para `provision-s3.sh` (que também garante block public access, SSE, versioning e lifecycle). Rode a partir de uma máquina com a role de operação. Ver detalhes em [`docs/aws.md`](docs/aws.md#cors).

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

Nenhuma ação manual é necessária além do DNS e do firewall (ver itens 3 e 6 do Passo 1): ao subir a stack com `docker compose -f docker-compose.prod.yml up -d --build`, o Caddy emite e renova o certificado Let's Encrypt automaticamente (HTTP-01 challenge na porta 80, sem Certbot/cron). Os certificados ficam persistidos no volume `caddy_data` entre restarts/updates.

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
- `apps/backend` (Go) precisaria ser hospedado à parte (Cloud Run, Fly.io, ECS, etc.), e `apps/web` apontaria os rewrites para a URL pública desse serviço (não para `localhost:3001`).
