// Package mocks contém os mocks gerados (go.uber.org/mock) dos ports de
// domain/ports/inbound — um arquivo por interface. São usados apenas por
// arquivos _test.go e ficam fora da regra de dependência do domínio.
//
// Rode `make generate` (ou `go generate ./...`) após alterar qualquer
// interface do pacote inbound.
package mocks

//go:generate go tool mockgen -typed -package mocks -destination aceite_use_case.go github.com/tiagods/webtool/apps/backend/domain/ports/inbound AceiteUseCase
//go:generate go tool mockgen -typed -package mocks -destination sessao_use_case.go github.com/tiagods/webtool/apps/backend/domain/ports/inbound SessaoUseCase
//go:generate go tool mockgen -typed -package mocks -destination rascunho_use_case.go github.com/tiagods/webtool/apps/backend/domain/ports/inbound RascunhoUseCase
//go:generate go tool mockgen -typed -package mocks -destination documento_use_case.go github.com/tiagods/webtool/apps/backend/domain/ports/inbound DocumentoUseCase
//go:generate go tool mockgen -typed -package mocks -destination submissao_use_case.go github.com/tiagods/webtool/apps/backend/domain/ports/inbound SubmissaoUseCase
//go:generate go tool mockgen -typed -package mocks -destination notificacao_use_case.go github.com/tiagods/webtool/apps/backend/domain/ports/inbound NotificacaoUseCase
