# Makefile do modulo Go (apps/backend). Assume `go` no PATH (>= 1.26).
# `make lint` tambem exige `golangci-lint` no PATH (ver README do modulo).
# Alvo APP seleciona o binario: `make build APP=worker`.

.PHONY: help build run vet fmt fmt-check golangci lint test test-integration tidy clean generate

GO           ?= go
GOLANGCI     ?= golangci-lint
APP          ?= api
BIN_DIR      := bin

help:
	@echo "Alvos disponiveis:"
	@echo "  make build            - compila cmd/\$$(APP) (binario estatico) em bin/"
	@echo "  make run              - roda cmd/\$$(APP) localmente"
	@echo "  make vet              - go vet ./..."
	@echo "  make fmt              - aplica gofmt em todo o modulo"
	@echo "  make fmt-check        - falha se houver arquivo fora do gofmt"
	@echo "  make golangci         - golangci-lint run ./..."
	@echo "  make lint             - vet + fmt-check + golangci"
	@echo "  make test             - go test ./... -race (unitarios)"
	@echo "  make test-integration - go test -tags integration ./... (exige Floci de pe)"
	@echo "  make generate         - regenera os mocks (go.uber.org/mock) dos ports"
	@echo "  make tidy             - sincroniza go.mod/go.sum"
	@echo "  make clean            - remove bin/"

build:
	CGO_ENABLED=0 $(GO) build -trimpath -ldflags='-s -w' -o $(BIN_DIR)/$(APP) ./cmd/$(APP)

run:
	$(GO) run ./cmd/$(APP)

vet:
	$(GO) vet ./...

fmt:
	gofmt -w .

fmt-check:
	@out="$$(gofmt -l .)"; \
	if [ -n "$$out" ]; then echo "arquivos fora do gofmt:"; echo "$$out"; exit 1; fi

golangci:
	$(GOLANGCI) run ./...

lint: vet fmt-check golangci

test:
	$(GO) test ./... -race -count=1

test-integration:
	$(GO) test -tags integration ./... -count=1

generate:
	$(GO) generate ./...

tidy:
	$(GO) mod tidy

clean:
	rm -rf $(BIN_DIR)
