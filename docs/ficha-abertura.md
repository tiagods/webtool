# Ficha Cadastral — Abertura de Empresa

## Protótipo

Design completo no Paper (5 artboards — Passos 1 a 5):
**[Abrir no Paper →](https://app.paper.design/file/01KP10MY4NWSR343R7HKDZ3KWA/1-0)**

| Artboard | Conteúdo |
|---|---|
| Passo 1 — Dados da Empresa | Nome empresarial (3 opções), nome fantasia, atividade, tipo de constituição |
| Passo 2 — Endereço | CEP com auto-fill, logradouro, IPTU, perguntas sobre o imóvel |
| Passo 3 — Sócios | Cards expansíveis por sócio, estado civil, pró-labore, "+ adicionar sócio" |
| Passo 4 — Documentos | Upload drag & drop, estados enviado/pendente, docs condicionais |
| Passo 5 — Revisão e Envio | Resumo editável por seção, termo de aceite, CTA gradiente |

---

## Tipos de constituição

O formulário cobre dois tipos. O tipo é selecionado no **Passo 1** e controla campos, validações e seções inteiras nos passos seguintes.

| | Ltda | SLU |
|---|---|---|
| Nome completo | Sociedade Limitada | Sociedade Limitada Unipessoal |
| Valor enum | `ltda` | `slu` |
| Nº de sócios | 2 a N (dinâmico) | Exatamente 1 |
| Capital social | Obrigatório | **Ausente** |
| Divisão de quotas | Obrigatório (% por sócio) | **Ausente** (100% implícito) |
| Sócios administradores | Obrigatório (lista) | **Ausente** (único sócio administra) |
| Tipo de administração | Obrigatório (conjunta / isolada / outras) | **Ausente** |
| Banco para conta PJ | Obrigatório | **Ausente** |
| Aviso no nome empresarial | "O nome pode ser o mesmo do responsável (empresa individual)" | Numeração explícita 1ª, 2ª, 3ª opção |

---

## Fluxo Multi-Step

O fluxo é **dinâmico** — o número de passos muda conforme o tipo de constituição selecionado no Passo 1.

**Ltda (6 passos):**
```
[1] Dados da Empresa → [2] Endereço → [3] Sócios → [4] Dados da Sociedade → [5] Documentos → [6] Revisão e Envio
```

**SLU (5 passos):**
```
[1] Dados da Empresa → [2] Endereço → [3] Sócios → [4] Documentos → [5] Revisão e Envio
```

> O **Passo 4 — Dados da Sociedade** é exclusivo da Ltda e contém: capital social, divisão de quotas, sócios administradores, tipo de administração e banco para conta PJ.

---

## Passo 1 — Dados da Empresa

### Campos comuns (Ltda e SLU)

| Campo | Tipo | Validação | Observações |
|---|---|---|---|
| Tipo de Constituição | `radio` | Obrigatório | `ltda` ou `slu` — define o restante do formulário |
| Nome Empresarial — 1ª opção | `text` | Obrigatório, min 3 chars | Busca de disponibilidade no órgão competente |
| Nome Empresarial — 2ª opção | `text` | Obrigatório | Em ordem de preferência |
| Nome Empresarial — 3ª opção | `text` | Obrigatório | Em ordem de preferência |
| Nome Fantasia | `text` | Opcional | Como a empresa será conhecida pelo público |
| Atividade da Empresa | `textarea` | Obrigatório, min 20 chars | Gênero e espécie (Dec. 1800/96, art. 53, III, "b") |

### Diferenças por tipo

**Ltda** — exibe o aviso abaixo dos campos de nome:
> "Caso a empresa seja individual, o nome da empresa será o mesmo do responsável. Assim, informar apenas o nome fantasia."

**SLU** — não exibe o aviso; o rótulo do bloco já contextualiza: *"(Sociedade Unipessoal) — escolher 3 opções"*. Os três campos de nome são numerados explicitamente como 1ª, 2ª e 3ª opção.

### Schema Zod

```ts
const stepDadosEmpresa = z.object({
  tipo: z.enum(['ltda', 'slu']),
  nomeEmpresarial1: z.string().min(3, 'Informe o 1º nome'),
  nomeEmpresarial2: z.string().min(3, 'Informe o 2º nome'),
  nomeEmpresarial3: z.string().min(3, 'Informe o 3º nome'),
  nomeFantasia: z.string().optional(),
  atividade: z.string().min(20, 'Descreva a atividade com mais detalhes'),
})
```

---

## Passo 2 — Endereço da Sede

**Idêntico para Ltda e SLU.**

### Campos

| Campo | Tipo | Validação | Observações |
|---|---|---|---|
| CEP | `text` (máscara `00000-000`) | Obrigatório | Dispara busca na ViaCEP |
| Logradouro | `text` | Obrigatório | Auto-preenchido via ViaCEP |
| Número | `text` | Obrigatório | |
| Complemento | `text` | Opcional | Sala, andar, conjunto... |
| Bairro | `text` | Obrigatório | Auto-preenchido via ViaCEP |
| Município | `text` | Obrigatório | Auto-preenchido via ViaCEP |
| Estado | `select` (UF) | Obrigatório | Auto-preenchido via ViaCEP |
| Nº do IPTU | `text` | Obrigatório | Consta no carnê de IPTU ou na conta de luz |
| Endereço é de correspondência? | `radio` | Obrigatório | `sim` / `nao` |
| Imóvel é alugado? | `radio` | Obrigatório | `sim` / `nao` |
| Locador é PF ou PJ? | `radio` | **Condicional** — obrigatório se `imovelAlugado === 'sim'` | `pessoa_fisica` / `pessoa_juridica` |
| Endereço de correspondência | `text` | **Condicional** — obrigatório se `correspondencia === 'nao'` | Onde a empresa receberá correspondências, se diferente da sede |
| Tipo de funcionamento | `radio` | Obrigatório | `estabelecimento` / `ponto_contato` |

### Regras de negócio

- CEP válido → `GET https://viacep.com.br/ws/{cep}/json/` → auto-preencher e desabilitar logradouro, bairro, município, estado.
- `imovelAlugado === 'sim'` → upload do contrato de locação torna-se obrigatório no Passo 4, **e** o campo `locadorTipo` (PF/PJ) torna-se obrigatório.
- `correspondencia === 'nao'` → o campo `enderecoCorrespondencia` torna-se obrigatório.

### Schema Zod

```ts
const stepEndereco = z.object({
  cep: z.string().regex(/^\d{5}-\d{3}$/, 'CEP inválido'),
  logradouro: z.string().min(2),
  numero: z.string().min(1, 'Informe o número'),
  complemento: z.string().optional(),
  bairro: z.string().min(2),
  municipio: z.string().min(2),
  estado: z.string().length(2),
  iptu: z.string().min(1, 'Informe o nº do IPTU'),
  correspondencia: z.enum(['sim', 'nao']),
  imovelAlugado: z.enum(['sim', 'nao']),
  locadorTipo: z.enum(['pessoa_fisica', 'pessoa_juridica']).optional(),   // obrigatório se imovelAlugado === 'sim'
  enderecoCorrespondencia: z.string().optional(),                          // obrigatório se correspondencia === 'nao'
  tipoFuncionamento: z.enum(['estabelecimento', 'ponto_contato']),
}).superRefine((d, ctx) => {
  if (d.imovelAlugado === 'sim' && !d.locadorTipo) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe se o locador é PF ou PJ', path: ['locadorTipo'] })
  }
  if (d.correspondencia === 'nao' && !d.enderecoCorrespondencia) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe o endereço de correspondência', path: ['enderecoCorrespondencia'] })
  }
})
```

---

## Passo 3 — Sócios

Campos de cada sócio — **idênticos para Ltda e SLU**. A diferença está no número de sócios permitidos.

> **Nota de escopo (não inflar):** o sócio da Abertura é **enxuto** — apenas os campos abaixo. CPF, RG e comprovantes entram como **upload de documento** (Passo 5), **não** como campos do formulário. Este perfil **não é o mesmo** da Ficha de Alteração Contratual (`ficha-alteracao.md`), cujo sócio (cedente/cessionário) é mais robusto (RG detalhado, CPF, naturalidade, filiação, endereço, participação). Os dois formulários de sócio **não devem compartilhar schema**.

### Campos por sócio

| Campo | Tipo | Validação | Observações |
|---|---|---|---|
| Nome Completo | `text` | Obrigatório | |
| Nº do PIS | `text` (máscara `000.00000.00-0`) | Obrigatório | |
| Profissão | `text` | Obrigatório | |
| Valor do Pró-labore | `currency` | Obrigatório | Mín. 1 salário mínimo |
| Telefone Celular | `text` (máscara `(00) 00000-0000`) | Obrigatório | |
| Telefone Fixo | `text` (máscara `(00) 0000-0000`) | Opcional | |
| E-mail | `email` | Obrigatório | |
| Estado Civil | `radio-chip` | Obrigatório | Ver opções abaixo |
| Participação societária anterior | `radio` | Obrigatório | `sim` / `nao` |
| CNPJ da empresa anterior | `text` (máscara) | Condicional | Obrigatório se `participacaoAnterior === 'sim'` |

### Opções de Estado Civil

```
solteiro | casado_comunhao_parcial | casado_comunhao_universal |
casado_separacao_bens | casado_separacao_obrigatoria | viuvo | separado_judicialmente
```

### Regras de negócio por tipo

| Regra | Ltda | SLU |
|---|---|---|
| Mínimo de sócios | 2 | 1 |
| Máximo de sócios | Sem limite (UI limita a 10) | 1 (botão "+ adicionar" fica oculto) |

### Schema Zod

```ts
const socioSchema = z.object({
  nome: z.string().min(3),
  pis: z.string().regex(/^\d{3}\.\d{5}\.\d{2}-\d$/),
  profissao: z.string().min(2),
  proLabore: z.number().min(1518, 'Mínimo 1 salário mínimo'),
  telefoneCelular: z.string().min(14),
  telefoneFixo: z.string().optional(),
  email: z.string().email(),
  estadoCivil: z.enum([
    'solteiro', 'casado_comunhao_parcial', 'casado_comunhao_universal',
    'casado_separacao_bens', 'casado_separacao_obrigatoria',
    'viuvo', 'separado_judicialmente',
  ]),
  participacaoAnterior: z.enum(['sim', 'nao']),
  cnpjAnterior: z.string().optional(),
}).refine(
  d => d.participacaoAnterior === 'nao' || !!d.cnpjAnterior,
  { message: 'Informe o CNPJ da empresa anterior', path: ['cnpjAnterior'] }
)

// Passo 3 — só valida os sócios
const stepSociosLtda = z.object({
  socios: z.array(socioSchema).min(2, 'Ltda requer ao menos 2 sócios'),
})

const stepSociosSlu = z.object({
  socios: z.array(socioSchema).length(1, 'SLU tem exatamente 1 sócio'),
})
```

---

## Passo 4 — Dados da Sociedade (exclusivo Ltda)

> **Este passo só aparece quando `tipo === 'ltda'`.** Na SLU, o fluxo pula diretamente para Documentos.

### Capital Social

| Campo | Tipo | Validação |
|---|---|---|
| Valor do Capital Social (R$) | `currency` | Obrigatório |

### Divisão de Quotas do Capital Social (%)

Um campo de percentual por sócio cadastrado no Passo 3. A soma deve totalizar 100%.

| Campo | Tipo | Validação |
|---|---|---|
| % do 1º sócio | `number` | Obrigatório, 0–100 |
| % do 2º sócio | `number` | Obrigatório, 0–100 |
| % do Nº sócio | `number` | Dinâmico — 1 campo por sócio |

> Regra: `soma(quotas) === 100` — validação cross-field.

### Sócios Administradores

| Campo | Tipo | Validação |
|---|---|---|
| Quais sócios são administradores | `checkbox` (múltiplo) | Pelo menos 1 obrigatório |

### Tipo de Administração

| Campo | Tipo | Validação | Opções |
|---|---|---|---|
| Como será a administração | `radio` | Obrigatório | `conjunta` / `isoladamente` / `outras` |

### Banco para Conta PJ

| Campo | Tipo | Validação |
|---|---|---|
| Em qual banco será aberta a conta bancária da empresa? | `text` ou `select` | Obrigatório |

### Schema Zod

```ts
const quotaSchema = z.object({
  socioIndex: z.number(),
  percentual: z.number().min(0.01).max(100),
})

const stepSociedade = z.object({
  capitalSocial: z.number().positive('Informe o capital social'),
  quotas: z.array(quotaSchema).refine(
    qs => Math.abs(qs.reduce((acc, q) => acc + q.percentual, 0) - 100) < 0.01,
    { message: 'A soma das quotas deve ser 100%' }
  ),
  sociosAdministradores: z.array(z.number()).min(1, 'Indique ao menos 1 administrador'),
  tipoAdministracao: z.enum(['conjunta', 'isoladamente', 'outras']),
  banco: z.string().min(2, 'Informe o banco'),
})
```

---

## Passo 5 — Documentos (Passo 4 na SLU)

**Idêntico para Ltda e SLU** — os documentos solicitados são os mesmos; apenas o número de sócios varia o volume de uploads. Organizados por **tabs por sócio** + tab "Imóvel".

Upload de arquivos. Formatos aceitos: **PDF, JPG, PNG**. Tamanho máximo: **10 MB por arquivo**.

### Lista de documentos

| Documento | Obrigatoriedade | Por |
|---|---|---|
| RG (frente e verso) | Obrigatório | Cada sócio |
| CPF | Obrigatório | Cada sócio |
| Comprovante de Residência | Obrigatório | Cada sócio |
| Certidão de Casamento | Condicional (`estadoCivil === 'casado_*'`) | Cada sócio casado |
| Registro em Conselho (CRM/OAB/CRECI/CORE) | Condicional (se aplicável à profissão) | Sócio com registro |
| Recibo IRPF (últimos 2 anos) | Obrigatório | Cada sócio |
| Título de Eleitor | Obrigatório | Cada sócio |
| IPTU do Imóvel | Obrigatório | Empresa |
| Contrato de Locação | Condicional (`imovelAlugado === 'sim'`) | Empresa |
| Senha Gov.BR | Instrução — não faz upload | Cada sócio |

---

## Passo 6 — Revisão e Envio (Passo 5 na SLU)

Exibe um resumo somente-leitura de todos os passos. A seção "Dados da Sociedade" só aparece quando `tipo === 'ltda'`.

### Ações disponíveis

| Ação | Comportamento |
|---|---|
| Editar (por seção) | Navega para o passo, retorna à revisão após salvar |
| Salvar rascunho | Persiste no banco com status `rascunho` |
| Enviar Ficha Cadastral | Valida tudo, gera PDF, envia e-mail para a equipe |

### Termo de aceite

Obrigatório marcar antes de habilitar o botão de envio.

### Fluxo de envio (server action)

```
1. Validar schema completo (stepDadosEmpresa + stepEndereco + stepSocios[tipo] + stepSociedade[ltda] + docs)
2. Gerar PDF da ficha com react-pdf
3. Upload do PDF gerado para S3
4. Enviar e-mail via Resend:
   - Para: contato@prolinkcontabil.com.br
   - Anexos: PDF da ficha + todos os documentos enviados
5. Atualizar status no banco para `enviado`
6. Redirecionar para página de confirmação
```

> **Nota:** A seção *"Campos para Preenchimento da Prolink"* (Tipo de Registro e Tipo Societário), presente no doc Word original, é preenchida internamente pela equipe contábil após o recebimento — **não deve aparecer no formulário público**.

---

## Estados do Formulário

```ts
type FormStatus = 'nao_iniciado' | 'rascunho' | 'enviado' | 'em_analise' | 'concluido'
```

---

## Documentos Originais

Os arquivos Word de referência estão em [../fichas/](../fichas/):

- `FICHA CADASTRAL - ABERTURA DE EMPRESA.doc` — Ltda (múltiplos sócios)
- `FICHA CADASTRAL -( ABERTURA UNIPESSOAL).doc` — SLU (sócio único)
- `DOCUMENTOS NECESSARIOS PARA ABERTURA.docx` — checklist de documentos
