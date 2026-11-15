# Compartilhado: cada ambiente liga este arquivo por symlink e define local.enable_pitr.
locals {
  partition_key = "sessionId"
  sort_key      = "versaoTermo"

  # Só os aceites têm sort key (um aceite por sessão e versão do termo).
  tables = {
    abertura  = { name = "FichasAbertura", sort = false }
    alteracao = { name = "FichasAlteracao", sort = false }
    aceites   = { name = "AceitesLgpd", sort = true }
  }
}

resource "aws_dynamodb_table" "this" {
  for_each = local.tables

  name         = each.value.name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = local.partition_key
  range_key    = each.value.sort ? local.sort_key : null

  attribute {
    name = local.partition_key
    type = "S"
  }

  dynamic "attribute" {
    for_each = each.value.sort ? [local.sort_key] : []
    content {
      name = attribute.value
      type = "S"
    }
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = local.enable_pitr
  }
}
