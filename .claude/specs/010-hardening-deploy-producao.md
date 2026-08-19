---
id: "010"
title: "Hardening de Deploy em Produção (CORS S3, TLS, validação E2E)"
status: done
created: 2026-07-07
author: "Claude"
batch_size: "small"
depends_on: ["008", "009"]
---

# Hardening de Deploy em Produção (CORS S3, TLS, validação E2E)

## Contexto

A Spec 008 deixou dois critérios de aceite explicitamente não fechados por dependerem de infraestrutura de produção real, fora do escopo daquela spec:

- CORS do bucket S3 hoje só está configurado para `http://localhost:3000` (`infra/local/init.sh`) — não existe ainda um script/processo para restringir `AllowedOrigins` ao domínio real de produção (`https://prolinkcontabil.com.br`, conforme já documentado em `docs/aws.md`).
- A Spec 009 deixou TLS/HTTPS explicitamente fora de escopo, delegando para `deploy.md`, que hoje só recomenda "Caddy ou Certbot + Nginx" em prosa, sem um roteiro executável.

Além disso, o fluxo `/abertura` → `/abertura/confirmacao` (incluindo restauração automática de rascunho no reload) foi validado na Spec 008 apenas via `curl`/SSR — nunca clicado em um navegador real de ponta a ponta. Antes do primeiro deploy em produção, essa lacuna precisa ser fechada.

## Objetivo

Fechar os itens de segurança/infra pendentes de produção identificados acima:

1. Script/comando reproduzível para configurar o CORS do bucket S3 real com origin restrito ao domínio de produção.
2. Roteiro executável de TLS/HTTPS na frente do `docker-compose.prod.yml` (Caddy como reverse proxy adicional, por ser o caminho de menor atrito — renovação automática de certificado sem Certbot manual).
3. Validação manual, em navegador real, do fluxo completo `/abertura` → preenchimento → refresh (restauração de rascunho) → upload → submit → `/abertura/confirmacao` (exibição do protocolo).

## Fora de escopo

- Provisionar o servidor de produção em si (Lightsail/VPS) ou comprar domínio.
- Configurar o firewall do servidor (já coberto em `deploy.md`, Spec 009).
- CI/CD.
- Qualquer mudança de contrato de API ou lógica de negócio.

## Design

### CORS S3 em produção

Hoje `infra/local/init.sh` roda contra o Floci (dev) com origin fixo `http://localhost:3000`. Para produção, adicionar um script separado (não reaproveitar o script de dev, que também provisiona tabelas/filas que já existem em produção real):

```bash
# infra/aws/set-cors-producao.sh
aws s3api put-bucket-cors \
  --bucket prolink-fichas \
  --cors-configuration '{"CORSRules":[{"AllowedOrigins":["https://prolinkcontabil.com.br"],"AllowedMethods":["PUT","HEAD"],"AllowedHeaders":["Content-Type","Content-Length","x-amz-*"],"ExposeHeaders":["ETag"],"MaxAgeSeconds":3000}]}'
```

Origin como argumento/variável de ambiente (`PROD_ORIGIN`), não hardcoded, para permitir domínio de staging futuro sem editar o script.

### TLS via Caddy

Caddy substitui a necessidade de gerenciar certificados manualmente (Certbot + cron de renovação): faz ACME/Let's Encrypt automático. Duas opções de topologia:

- **Caddy na frente do Nginx** (`Internet → Caddy:443 → Nginx:80 → web/api`): menor mudança, mantém o Nginx existente como está.
- **Caddy substituindo o Nginx**: reduz uma camada, mas exige portar `infra/nginx/default.conf` para `Caddyfile` — mais mudança para o mesmo resultado.

Recomendação: manter o Nginx (opção 1) — `Caddyfile` mínimo, roteando 443 para `nginx:80` internamente, documentado em `deploy.md` como Passo 4 (hoje só um parágrafo em prosa).

### Validação manual E2E (navegador real)

Roteiro a ser executado (localmente via `docker compose up` ou `npm run dev` em paralelo) e registrado como evidência no batch:

1. Abrir `/abertura` em um navegador real, aceitar o termo LGPD.
2. Preencher até o passo de Documentos, fazer upload de ao menos um arquivo.
3. Dar refresh (F5) na página — confirmar que o rascunho é restaurado automaticamente (dados preenchidos + arquivo já enviado não pedem novo upload).
4. Completar o preenchimento e enviar (`POST /api/submit`).
5. Confirmar redirecionamento para `/abertura/confirmacao?protocolo=...` exibindo o protocolo e os próximos passos corretamente.

### Camadas afetadas

| Camada | Arquivo | Ação |
|--------|---------|------|
| Infra | `infra/aws/set-cors-producao.sh` | CREATE |
| Infra | `Caddyfile` (raiz ou `infra/caddy/`) | CREATE |
| Docs | `deploy.md` | MODIFY — roteiro executável de TLS (Passo 4) + comando de CORS produção |
| Docs | `docs/aws.md` | MODIFY — referenciar o script novo em vez de deixar a tabela de CORS só como especificação |

## Critérios de aceite

- [x] `infra/aws/set-cors-producao.sh` criado, parametrizado por origin, aplicando `PUT`/`HEAD` restrito ao domínio de produção
- [x] `Caddyfile` criado e documentado, roteando 443 → `nginx:80`, com TLS automático (Let's Encrypt)
- [x] `deploy.md` atualizado com passo a passo executável de TLS (substitui o parágrafo em prosa atual)
- [x] Validação manual em navegador real do fluxo `/abertura` → refresh (restauração de rascunho) → upload → submit → `/abertura/confirmacao` — **executada e validada pelo usuário** (2026-07-07/08); encontrou e reportou o bug de salvamento de rascunho corrigido durante esta mesma validação (ver `lessons.md`)
- [x] `npm run lint` e `npm run build` passando (sem impacto esperado em `apps/web`/`apps/api`, mas confirmar)

## Notas

- O item de validação manual em navegador é o item central pedido pelo usuário nesta spec — os demais critérios (CORS, TLS) são scripts/documentação que o agente pode preparar, mas a validação do fluxo em si depende de um navegador real, que o agente não tem disponível nesta sessão.
- Decisão de usar Caddy em vez de Certbot+Nginx manual: menos partes móveis (sem cron de renovação separado), mas é uma escolha reversível — se o usuário preferir Certbot, o roteiro em `deploy.md` pode ser trocado sem impacto nas outras specs.
