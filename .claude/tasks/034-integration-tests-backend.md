# Spec 034 — Integration Tests Backend

## Todo

### Bloco 1 — Test helpers + data files
- [ ] `infrastructure/testhelpers/setup.go` — SetupIntegration, TestDeps, MockEmailSender
- [ ] `scripts/integration_tests/data/s3/contrato_social.pdf` — PDF dummy
- [ ] `scripts/integration_tests/data/s3/rg_socio_1.jpg` — JPEG dummy
- [ ] `scripts/integration_tests/data/dynamodb/rascunho_abertura.json`
- [ ] `scripts/integration_tests/data/dynamodb/rascunho_alteracao.json`
- [ ] `scripts/integration_tests/data/dynamodb/rascunho_invalido.json`
- [ ] `scripts/integration_tests/data/sqs/mensagem_abertura.json`
- [ ] `scripts/integration_tests/data/sqs/mensagem_alteracao.json`
- [ ] `scripts/integration_tests/data/sqs/mensagem_invalida.json`

### Bloco 2 — Testes de API (abertura)
- [ ] `infrastructure/api_submit_abertura_integration_test.go` — 3 cenários

### Bloco 3 — Testes de API (alteração)
- [ ] `infrastructure/api_submit_alteracao_integration_test.go` — 2 cenários

### Bloco 4 — Testes de borda
- [ ] `infrastructure/api_borda_integration_test.go` — 6 cenários

### Bloco 5 — Testes de Worker
- [ ] `infrastructure/worker_integration_test.go` — 5 cenários

### Bloco 6 — Verificação final
- [ ] `make test` — unitários ainda passam
- [ ] `make lint` — vet + fmt + golangci-lint passam
- [ ] Executar todos os cenários e marcar CA `[x]` na spec