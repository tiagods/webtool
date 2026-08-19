# Guia de Deploy - Prolink Webtool

Desde a [Spec 009](.claude/specs/009-separacao-frontend-backend.md), o projeto é composto por dois serviços Next.js separados (`apps/web` e `apps/api`) atrás de um Nginx, orquestrados via Docker Compose. O caminho de deploy recomendado é **Docker Compose em um servidor com Docker instalado** (VPS, Lightsail, EC2, etc.), usando o arquivo `docker-compose.prod.yml` da raiz do repositório.

---

## Deploy via Docker Compose (recomendado)

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
4. Configure as credenciais AWS reais para o serviço `api` — via variáveis de ambiente do host, IAM role da instância (recomendado em EC2/Lightsail), ou um `.env` na raiz do projeto lido pelo Compose (`AWS_REGION`, `AWS_DYNAMODB_TABLE`, `AWS_DYNAMODB_ALTERACAO_TABLE`, `AWS_S3_BUCKET`, `AWS_SQS_QUEUE_URL`, `AWS_SNS_TOPIC_ARN`, `JWT_SECRET`). Sem `AWS_ENDPOINT_URL` definido, os clients em `apps/api/lib/aws/*.ts` usam a cadeia de credenciais padrão do AWS SDK — nenhuma mudança de código é necessária entre dev (Floci) e produção.
5. Aponte o DNS do domínio de produção (`prolinkcontabil.com.br` e `www.prolinkcontabil.com.br`) para o IP público do servidor — pré-requisito para a emissão automática do certificado TLS no Passo 4.
6. Configure o CORS do bucket S3 real, restrito ao domínio de produção:
   ```bash
   PROD_ORIGIN=https://prolinkcontabil.com.br ./infra/aws/set-cors-producao.sh
   ```
   Rode esse comando uma vez (ou sempre que o domínio de produção mudar) a partir de uma máquina com credenciais AWS configuradas (CLI local ou o próprio servidor, se tiver IAM role/credenciais). Ver detalhes em [`docs/aws.md`](docs/aws.md#cors).

### Passo 2: Clonar o projeto

```bash
git clone https://seu-repositorio-git/prolink-webtool.git
cd prolink-webtool
```

### Passo 3: Subir a stack de produção

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Isso builda e sobe quatro containers: `web` (:3000), `api` (:3001), `nginx` (interno, sem porta publicada) e `caddy` (:80, :443). O Nginx roteia `/` → `web` e `/api/*` → `api` (ver `infra/nginx/default.conf`); o Caddy termina TLS e repassa tudo para o Nginx internamente (ver Passo 4). A aplicação fica disponível em `https://prolinkcontabil.com.br`.

### Passo 4: TLS/HTTPS (Caddy)

O `Caddyfile` na raiz do repositório já está configurado para `prolinkcontabil.com.br` e `www.prolinkcontabil.com.br`, repassando para `nginx:80` internamente:

```
prolinkcontabil.com.br, www.prolinkcontabil.com.br {
	reverse_proxy nginx:80
}
```

Nenhuma ação manual é necessária além do DNS e do firewall (ver itens 3 e 5 do Passo 1): ao subir a stack com `docker compose -f docker-compose.prod.yml up -d --build`, o Caddy emite e renova o certificado Let's Encrypt automaticamente (HTTP-01 challenge na porta 80, sem Certbot/cron). Os certificados ficam persistidos no volume `caddy_data` entre restarts/updates.

Se o domínio de produção mudar, edite o `Caddyfile` antes de subir a stack novamente.

### Atualizações

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Alternativa: Vercel (apenas para `apps/web`)

A Vercel é adequada para hospedar `apps/web` isoladamente (CDN global, SSL automático, deploy por push), mas **não é recomendada para `apps/api`** nesta arquitetura: o objetivo da Spec 009 é justamente manter o backend fora de acesso público direto via firewall, o que a Vercel (serverless, sempre publicamente acessível) não permite replicar. Usar a Vercel exigiria expor `apps/api` publicamente e depender só de outras camadas de segurança (rate limiting, auth) — uma escolha válida, mas diferente do modelo desta spec. Se optar por esse caminho:

- **Root Directory**: `apps/web`
- **Framework Preset**: Next.js (detectado automaticamente)
- `apps/api` precisaria de um projeto Vercel separado, e `apps/web` apontaria `NEXT_PUBLIC_BASE_URL`/rewrites para a URL pública da Vercel do `apps/api` (não para `localhost:3001`).
