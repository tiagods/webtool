# Terraform — infraestrutura AWS

```
scripts/terraform/
├── modules/dados/   # DynamoDB ×3 + S3 + SQS (fila + DLQ) — usado por local e production
├── local/           # Floci (dev) — rodado pelo container aws-init no `npm run infra:up`
└── production/      # AWS real + IAM users ApiApp/WorkerApp — rodado à mão pelo operador
```

O módulo `dados` é a única definição de tabelas, bucket e filas: o que difere entre os
ambientes entra por variável (`cors_allowed_origins`, `enable_pitr`, `harden_bucket`).

## Local (Floci)

Nada a instalar: `npm run infra:up` sobe o Floci e o `aws-init` roda
`terraform apply` (imagem `hashicorp/terraform`, versão fixada no compose).
O state fica em `scripts/terraform/local/terraform.tfstate` (gitignorado).

`npm run infra:reset` apaga o volume do Floci **e** o state — sem isso o state apontaria
para recursos que não existem mais.

## Production

Pré-requisitos: Terraform ≥ 1.6 e credenciais de uma **IAM role assumida** (SSO ou
`assume-role`). O `check "operador_nao_e_iam_user"` avisa quando o operador é um IAM user.

```bash
cd scripts/terraform/production
terraform init
terraform plan      # revisar
terraform apply
```

- **State**: `production/terraform.tfstate`, gitignorado, sem lock. Existe só na máquina do
  operador — faça backup fora do repo. Perdê-lo obriga a `terraform import` de cada recurso.
- **Access keys**: o Terraform **não** cria `aws_iam_access_key` (o secret iria para o state).
  Gere com `aws iam create-access-key --user-name ApiApp` (e `WorkerApp`) e ponha no `.env`
  do servidor como `API_AWS_*` / `WORKER_AWS_*`.
- **Recursos já existentes** (criados pelos scripts antigos): `terraform import` antes do
  primeiro `apply`, ex.: `terraform import 'module.dados.aws_dynamodb_table.this["abertura"]' FichasAbertura`.

## Formatação e validação

```bash
terraform fmt -check -recursive scripts/terraform
terraform -chdir=scripts/terraform/local init -backend=false && terraform -chdir=scripts/terraform/local validate
terraform -chdir=scripts/terraform/production init -backend=false && terraform -chdir=scripts/terraform/production validate
```
