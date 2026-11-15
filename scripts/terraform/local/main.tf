module "dados" {
  source = "../modules/dados"

  cors_allowed_origins = var.cors_allowed_origins
}
