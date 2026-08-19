.PHONY: help lint build clean security test

help:
	@echo "Alvos disponiveis:"
	@echo "  make lint      - roda npm run lint (apps/web + apps/api)"
	@echo "  make build     - roda npm run build (apps/web + apps/api)"
	@echo "  make clean     - remove node_modules e artefatos de build (.next)"
	@echo "  make security  - roda npm audit (dependencias do monorepo)"
	@echo "  make test      - roda a suite de testes (ainda nao configurada)"

lint:
	npm run lint

build:
	npm run build

clean:
	rm -rf node_modules apps/web/node_modules apps/api/node_modules packages/shared/node_modules
	rm -rf apps/web/.next apps/api/.next

security:
	npm audit

test:
	@echo "Nenhuma suite de testes configurada ainda (ver .claude/specs/014, 015, 016, 017)."
