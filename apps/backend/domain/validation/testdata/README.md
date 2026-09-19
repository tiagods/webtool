# testdata — fixtures de caracterização

Dados **100% sintéticos**, gerados por `scripts/gen-{abertura,alteracao}-characterization.mjs`
a partir dos schemas Zod de `packages/shared`:

- e-mails em `@example.com` (domínio reservado pela RFC 2606);
- CPF/CNPJ/telefone fictícios, com dígito verificador válido (exigido pelos casos "válidos").

**Não usar PII real aqui.**
