module "dados" {
  source = "../modules/dados"

  cors_allowed_origins = var.cors_allowed_origins
  enable_pitr          = true
  harden_bucket        = true
}

data "aws_caller_identity" "operador" {}

# O apply deve rodar com uma role assumida: um IAM user como operador implica
# access key estática no equipamento do operador.
check "operador_nao_e_iam_user" {
  assert {
    condition     = !strcontains(data.aws_caller_identity.operador.arn, ":user/")
    error_message = "O apply em production deve usar uma IAM role assumida, não um IAM user (${data.aws_caller_identity.operador.arn})."
  }
}
