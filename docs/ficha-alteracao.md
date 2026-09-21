# Ficha Cadastral — Alteração Contratual

Formulário para solicitar alterações nos dados cadastrais de uma empresa já constituída. O cliente preenche apenas os quadros que se aplicam à alteração desejada.

---

## Protótipo

Design no Paper (4 passos):
**[Abrir no Paper →](https://app.paper.design/file/01KP10MY4NWSR343R7HKDZ3KWA/3-0)**

| Artboard | Conteúdo |
|---|---|
| Passo 1 — Identificação | Busca por CNPJ, exibe dados da empresa encontrada (Receita Federal) |
| Passo 2 — Tipo de Alteração | Seleção múltipla dos quadros a alterar, agrupados por seção |
| Passo 3 — Novos Dados | Formulário dinâmico por quadro selecionado |
| Passo 4 — Revisão e Envio | Comparativo antes/depois por quadro, declaração de aceite, CTA de envio |

---

## Quadros disponíveis (9 no total)

| Quadro | Nome | Quando usar |
|---|---|---|
| Q01 | Razão Social | Alterar o nome empresarial (3 opções) |
| Q02 | Objeto Social | Alterar a atividade exercida (CNAE) |
| Q03 | Mudança de Endereço da Sede | Novo endereço da sede |
| Q04 | Quadro Societário | Entrada ou saída de sócios |
| Q05 | Alteração do Capital Social | Aumentar ou reduzir o capital registrado |
| Q06 | Redistribuição do Capital entre Sócios | Alterar percentual/valor por sócio sem mudar o total |
| Q07 | Transformação da Natureza Jurídica | Ltda ↔ Simples Limitada ou outra transformação |
| Q08 | Alteração da Administração | Mudar os sócios administradores |
| Q09 | Outras Alterações | Alterações não cobertas pelos quadros anteriores |

### Agrupamento no Passo 2 (UI)

| Grupo | Quadros |
|---|---|
| Dados da Empresa | Q01 — Razão Social, Q02 — Objeto Social |
| Endereço | Q03 — Endereço da Sede |
| Quadro Societário | Q04 — Entrada/Saída de Sócio, Q05 — Capital Social, Q06 — Redistribuição do Capital |
| Administração e Estrutura | Q08 — Administração, Q07 — Natureza Jurídica |
| Outras | Q09 — Outras Alterações |

---

## Fluxo Multi-Step

```
[1] Identificação → [2] Tipo de Alteração → [3] Novos Dados → [4] Revisão e Envio
```

---

## Passo 1 — Identificação da Empresa

O cliente informa o CNPJ da empresa. Os dados são consultados na Receita Federal e exibidos para confirmação antes de prosseguir.

### Campos

| Campo | Tipo | Validação |
|---|---|---|
| CNPJ | `text` (máscara `00.000.000/0000-00`) | Obrigatório, CNPJ válido |

### Dados exibidos após busca (somente leitura)

Razão Social, Nome Fantasia, CNPJ, Tipo de Constituição, Endereço Atual, Status (`ATIVA` / `INAPTA` / `BAIXADA`).

> Apenas empresas com status `ATIVA` podem prosseguir.

### Schema Zod

```ts
const stepIdentificacao = z.object({
  cnpj: z.string().regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, 'CNPJ inválido'),
})
```

---

## Passo 2 — Tipo de Alteração

Seleção múltipla. O Passo 3 exibe somente os formulários dos quadros selecionados.

### Schema Zod

```ts
const quadroAlteracao = z.enum([
  'nome_empresarial',   // Q01
  'objeto_social',      // Q02
  'endereco',           // Q03
  'quadro_societario',  // Q04
  'capital_social',     // Q05
  'redistribuicao_capital', // Q06
  'natureza_juridica',  // Q07
  'administracao',      // Q08
  'outras_alteracoes',  // Q09
])

const stepTipoAlteracao = z.object({
  quadros: z.array(quadroAlteracao).min(1, 'Selecione pelo menos um quadro'),
})
```

---

## Passo 3 — Novos Dados

Cada seção abaixo aparece apenas se o quadro correspondente foi selecionado.

---

### Q01 — Razão Social

| Campo | Tipo | Validação |
|---|---|---|
| 1ª opção de nome | `text` | Obrigatório |
| 2ª opção de nome | `text` | Obrigatório |
| 3ª opção de nome | `text` | Obrigatório |

> Será realizada busca de disponibilidade no órgão de registro competente.

---

### Q02 — Objeto Social

| Campo | Tipo | Validação |
|---|---|---|
| Descrição do novo objeto social | `textarea` | Obrigatório |

> Não pode ser ilícito, impossível ou indeterminado. Deve conter declaração precisa da atividade (gênero e espécie) — Decreto 1800/96, art. 53, III, "b".

---

### Q03 — Mudança de Endereço da Sede

| Campo | Tipo | Validação |
|-------|------|-----------|
| Logradouro | `text` | Obrigatório |
| Bairro | `text` | Obrigatório |
| Município | `text` | Obrigatório |
| Estado | `select` (UF) | Obrigatório |
| CEP | `text` (máscara `00000-000`) | Obrigatório |
| Nº do IPTU | `text` | Obrigatório |

> **Nota:** Na ficha original, o campo "endereço" é um campo único que inclui o logradouro e o número (ex: "Rua X, 123"). O campo `logradouro` no schema modela isso como string livre.
> Este endereço NÃO inclui os campos do Passo 2 da Abertura (correspondência, locador, tipo de funcionamento) — são formulários com escopos diferentes.

---

### Q04 — Quadro Societário

Dois tipos de bloco, cada um repetível:

| Tipo | Descrição |
|---|---|
| `cedente` | Sócio que **sai** da sociedade |
| `cessionario` | Sócio que **entra** na sociedade |

#### Campos — Cedente (quem sai)

| Campo | Tipo | Validação |
|---|---|---|
| Nome Completo | `text` | Obrigatório |
| Naturalidade | `text` | Obrigatório |
| Estado de Naturalidade | `select` (UF) | Obrigatório |
| Profissão | `text` | Obrigatório |
| RG (número) | `text` | Obrigatório |
| Dígito RG | `text` | Obrigatório |
| Órgão Expedidor | `text` | Obrigatório |
| Estado Expedidor | `select` (UF) | Obrigatório |
| CPF | `text` (máscara `000.000.000-00`) | Obrigatório |
| Data de Expedição RG | `date` | Obrigatório |
| Data de Nascimento | `date` | Obrigatório |
| Idade | calculado | Auto-calculado |
| Nº do PIS | `text` | Obrigatório |
| Endereço (logradouro, nº, bairro, município, estado, CEP) | grupo | Obrigatório |
| Telefone Residencial | `text` | Opcional |
| Telefone Comercial + Ramal | `text` | Opcional |
| Celular | `text` | Obrigatório |
| E-mail | `email` | Obrigatório |
| Recados | `text` | Opcional |
| Nome da Mãe | `text` | Obrigatório |
| Nome do Pai | `text` | Opcional |
| Participação societária anterior | `radio` (`sim` / `nao`) | Obrigatório |
| CNPJ da empresa anterior | `text` (máscara) | Condicional — obrigatório se `sim` |
| Percentual de participação na sociedade | `number` (%) | Obrigatório |
| Valor em R$ da participação | `currency` | Obrigatório |
| Estado Civil | `radio-chip` | Obrigatório |

#### Campos adicionais — Cessionário (quem entra)

Todos os campos do Cedente, mais:

| Campo | Tipo | Validação |
|---|---|---|
| Será sócio administrador? | `text` | Obrigatório |
| Valor do Pró-labore | `currency` | Obrigatório |

#### Opções de Estado Civil

```
solteiro | casado_comunhao_parcial | casado_comunhao_universal |
casado_separacao_bens | casado_separacao_obrigatoria |
separado_judicialmente | divorciado | viuvo
```

#### Schema Zod

```ts
const estadoCivil = z.enum([
  'solteiro',
  'casado_comunhao_parcial',
  'casado_comunhao_universal',
  'casado_separacao_bens',
  'casado_separacao_obrigatoria',
  'separado_judicialmente',
  'divorciado',
  'viuvo',
])

const membroBase = z.object({
  tipo: z.enum(['cedente', 'cessionario']),
  nomeCompleto: z.string().min(3),
  naturalidade: z.string().min(2),
  estadoNaturalidade: z.string().length(2),
  profissao: z.string().min(2),
  rg: z.string().min(5),
  digitoRg: z.string().max(2),
  orgaoExpedidor: z.string().min(2),
  estadoExpedidor: z.string().length(2),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/),
  dataExpedicaoRg: z.string(),
  dataNascimento: z.string(),
  pis: z.string(),
  logradouro: z.string().min(2),
  numero: z.string().min(1),
  bairro: z.string().min(2),
  municipio: z.string().min(2),
  estado: z.string().length(2),
  cep: z.string(),
  telefoneResidencial: z.string().optional(),
  telefoneComercial: z.string().optional(),
  ramal: z.string().optional(),
  celular: z.string().min(14),
  email: z.string().email(),
  recados: z.string().optional(),
  nomeMae: z.string().min(3),
  nomePai: z.string().optional(),
  participacaoAnterior: z.enum(['sim', 'nao']),
  cnpjAnterior: z.string().optional(),
  percentualParticipacao: z.number().min(0.01).max(100),
  valorParticipacao: z.number().positive(),
  estadoCivil,
}).refine(
  d => d.participacaoAnterior === 'nao' || !!d.cnpjAnterior,
  { message: 'Informe o CNPJ da empresa anterior', path: ['cnpjAnterior'] }
)

const cessionario = membroBase.extend({
  socioAdministrador: z.string().min(1),
  proLabore: z.number().positive(),
})
```

---

### Q05 — Alteração do Capital Social

| Campo | Tipo | Validação |
|-------|------|-----------|
| Tipo de Alteração | `radio` | Obrigatório — `aumento` / `reducao` |
| Valor do Capital Social (R$) | `currency` | Obrigatório |
| Forma da integralização — valor (R$) | `currency` | **Condicional** — obrigatório se `aumento` |
| Especificar | `textarea` | **Condicional** — obrigatório se `aumento` |

> **Nota:** A ficha original tem título "Aumento ou Redução" mas só detalha campos para AUMENTO (integralização + especificar). A implementação adiciona `tipoAlteracao` como enum explícito — para REDUÇÃO, apenas `valorCapitalSocial` é exigido, consistente com a ficha.

---

### Q06 — Redistribuição do Capital Social entre os Sócios

Um bloco por sócio.

| Campo | Tipo | Validação |
|---|---|---|
| Nome do Sócio | `text` | Obrigatório |
| Total do Percentual (%) | `number` | Obrigatório |
| Valor em R$ | `currency` | Obrigatório |

---

### Q07 — Alteração/Transformação da Natureza Jurídica

| Campo | Tipo | Validação |
|---|---|---|
| Tipo de transformação | `radio` | Obrigatório |
| Especificar (se "Outras") | `textarea` | Condicional |

**Opções:**
- `ltda_para_simples` — De Sociedade Empresária Limitada para Sociedade Simples Limitada (Registro no Cartório)
- `simples_para_ltda` — De Sociedade Simples Limitada para Sociedade Empresária Limitada (Registro na JUCESP)
- `outras` — Outras (campo livre)

---

### Q08 — Alteração da Administração da Sociedade

| Campo | Tipo | Validação |
|---|---|---|
| Nome(s) do(s) sócio(s) administrador(es) | `text` (múltiplos) | Obrigatório, mín. 1 |

---

### Q09 — Outras Alterações

| Campo | Tipo | Validação |
|---|---|---|
| Descrição | `textarea` | Obrigatório |

---

## Passo 4 — Revisão e Envio

Resumo por quadro com comparativo antes/depois. Edição disponível por seção antes de enviar.

### Ações

| Ação | Comportamento |
|---|---|
| → Editar (por seção) | Navega para o passo, retorna à revisão após salvar |
| ← Anterior | Volta ao Passo 3 |
| Enviar Solicitação | Valida tudo, gera PDF, envia e-mail para a equipe |

### Fluxo de envio (server action)

```
1. Validar schema completo
2. Gerar PDF da solicitação (react-pdf)
3. Upload do PDF para S3
4. Enviar e-mail via Resend para contato@prolinkcontabil.com.br com PDF
5. Atualizar status no banco para `enviado`
6. Redirecionar para página de confirmação
```

---

## Estados do Formulário

```ts
type FormStatus = 'nao_iniciado' | 'rascunho' | 'enviado' | 'em_analise' | 'concluido'
```

---

## Documento Original

[../fichas/FICHA CADASTRAL - ALTERAÇÃO CONTRATUAL.pdf](../fichas/FICHA%20CADASTRAL%20-%20ALTERA%C3%87%C3%83O%20CONTRATUAL.pdf)
---

## Recursos Compartilhados com a Ficha de Abertura

Alguns enums e constantes são compartilhados entre os dois formulários para evitar
divergência. A fonte centralizada é `packages/shared/src/constants/enums.ts`.

| Constante | Usado em | Valores |
|-----------|----------|---------|
| `TIPO_CONSTITUICAO` | Abertura + Alteração | `ltda`, `slu` |
| `ESTADO_CIVIL_BASE` | Abertura | 7 valores (sem `divorciado`) |
| `ESTADO_CIVIL_ALTERACAO` | Alteração | 8 valores (base + `divorciado`) |

> **Schemas não compartilhados:** O sócio da Alteração (~30 campos) e o da Abertura
> (10 campos) são schemas independentes — cada um reflete sua respectiva ficha original.
> O endereço do Q03 também é independente do Passo 2 da Abertura (que tem campos de
> correspondência e locador ausentes na Alteração).
