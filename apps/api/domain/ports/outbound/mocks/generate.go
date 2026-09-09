// Package mocks contém os mocks gerados (go.uber.org/mock) dos ports de
// domain/ports/outbound — um arquivo por interface. São usados apenas por
// arquivos _test.go e ficam fora da regra de dependência do domínio.
//
// Rode `make generate` (ou `go generate ./...`) após alterar qualquer interface
// do pacote outbound.
package mocks

//go:generate go tool mockgen -typed -package mocks -destination aceite_repository.go github.com/tiagods/webtool/apps/api/domain/ports/outbound AceiteRepository
//go:generate go tool mockgen -typed -package mocks -destination documento_storage.go github.com/tiagods/webtool/apps/api/domain/ports/outbound DocumentoStorage
//go:generate go tool mockgen -typed -package mocks -destination protocolo_counter.go github.com/tiagods/webtool/apps/api/domain/ports/outbound ProtocoloCounter
//go:generate go tool mockgen -typed -package mocks -destination rascunho_repository.go github.com/tiagods/webtool/apps/api/domain/ports/outbound RascunhoRepository
//go:generate go tool mockgen -typed -package mocks -destination submissao_publisher.go github.com/tiagods/webtool/apps/api/domain/ports/outbound SubmissaoPublisher
//go:generate go tool mockgen -typed -package mocks -destination token_service.go github.com/tiagods/webtool/apps/api/domain/ports/outbound TokenService
