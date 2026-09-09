.PHONY: help lint build clean security test

help:
	@echo "Alvos disponiveis (frontend Node; o backend Go tem o proprio Makefile em apps/api/):"
	@echo "  make lint      - roda npm run lint (apps/web)"
	@echo "  make build     - roda npm run build (apps/web)"
	@echo "  make clean     - remove node_modules e artefatos de build (.next)"
	@echo "  make security  - roda npm audit (dependencias do monorepo Node)"
	@echo "  make test      - lembra onde rodar os testes (Go: make -C apps/api test)"

lint:
	npm run lint

build:
	npm run build

clean:
	rm -rf node_modules apps/web/node_modules apps/api-node/node_modules packages/shared/node_modules
	rm -rf apps/web/.next apps/api-node/.next

security:
	npm audit

test:
	@echo "Backend Go: 'make -C apps/api test'. Frontend: ver .claude/specs/014, 017."
