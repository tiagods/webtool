locals {
  partition_key = "sessionId"
  sort_key      = "versaoTermo"

  # Só os aceites têm sort key (um aceite por sessão e versão do termo).
  tables = {
    abertura  = { name = var.abertura_table_name, sort = false }
    alteracao = { name = var.alteracao_table_name, sort = false }
    aceites   = { name = var.aceites_table_name, sort = true }
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
    attribute_name = var.ttl_attribute
    enabled        = true
  }

  point_in_time_recovery {
    enabled = var.enable_pitr
  }
}
